# LUNA NAVIGATOR — Scientific & Mathematical Methodology

## 1. Celestial Coordinate Systems & Reference Frames

Evaluating lunar landing sites requires rigorous handling of multiple astronomical coordinate frames:

### 1.1 International Celestial Reference Frame (ICRF / J2000)
- An inertial frame centered at the Solar System Barycenter (SSB) or Earth center.
- Used as the reference frame for planetary ephemerides exported by JPL Horizons.

### 1.2 Lunar Body-Fixed Selenographic Frames
Planetary data products use the **Lunar Mean Earth / Polar Axis (ME)** frame:
- **Origin**: Lunar center of mass ($r = 0$).
- **Z-axis**: Mean lunar rotation axis (direction of Lunar North Pole).
- **X-axis**: Intersection of the lunar equator and the prime meridian (pointing towards the mean position of Earth at zero libration).
- **Y-axis**: Completes right-handed orthogonal system ($Y = Z \times X$).

For higher accuracy, the **Principal Axis (PA)** frame differs from the ME frame by small rotational offsets ($\sim 60-80$ arcseconds). NASA LOLA gridded data records are tied directly to the ME frame.

### 1.3 Transformation from Selenographic $(\phi, \lambda, h)$ to Cartesian $(X, Y, Z)$
Given:
- Latitude $\phi$ (positive North, negative South)
- Longitude $\lambda$ (East positive, $[0, 360^\circ)$ or $[-180^\circ, 180^\circ]$)
- Topographic elevation $h$ above the reference sphere of radius $R_{moon} = 1737.4\text{ km}$ ($1,737,400\text{ m}$)

$$R = R_{moon} + h$$
$$X = R \cos\phi \cos\lambda$$
$$Y = R \cos\phi \sin\lambda$$
$$Z = R \sin\phi$$

---

## 2. Observer Topocentric Horizon Frame

To an observer on the lunar surface, celestial objects (Sun, Earth) are observed in local horizontal coordinates: **Azimuth ($Az$)** and **Elevation ($El$)**.

### 2.1 Basis Vectors of Topocentric Frame
At lunar position $(\phi, \lambda)$:
- **Zenith (Up, $\hat{u}$)**:
  $$\hat{u} = (\cos\phi \cos\lambda, \cos\phi \sin\lambda, \sin\phi)$$
- **North ($\hat{n}$)**:
  $$\hat{n} = (-\sin\phi \cos\lambda, -\sin\phi \sin\lambda, \cos\phi)$$
- **East ($\hat{e}$)**:
  $$\hat{e} = (-\sin\lambda, \cos\lambda, 0)$$

Note that $\hat{u} \cdot \hat{n} = 0$, $\hat{u} \cdot \hat{e} = 0$, and $\hat{e} = \hat{n} \times \hat{u}$ in a right-handed system.

### 2.2 Local Coordinates of a Celestial Body
Let $\vec{r}_{body}$ be the position vector of the target body (Sun or Earth) in the Moon-centered Selenographic ME frame, and $\vec{r}_{site}$ be the observer's position vector.
The relative vector from site to body is:
$$\vec{\rho} = \vec{r}_{body} - \vec{r}_{site}$$
$$\rho = \|\vec{\rho}\|$$
$$\hat{\rho} = \frac{\vec{\rho}}{\rho}$$

Projecting $\hat{\rho}$ onto local topocentric axes:
$$\rho_e = \vec{\rho} \cdot \hat{e}$$
$$\rho_n = \vec{\rho} \cdot \hat{n}$$
$$\rho_u = \vec{\rho} \cdot \hat{u}$$

The **Elevation angle ($El$)** above the local horizontal tangent plane is:
$$El = \arcsin\left(\frac{\rho_u}{\rho}\right)$$

The **Azimuth angle ($Az$)** measured clockwise from North ($0^\circ = \text{North}, 90^\circ = \text{East}, 180^\circ = \text{South}, 270^\circ = \text{West}$):
$$Az = \text{atan2}(\rho_e, \rho_n) \pmod{360^\circ}$$

---

## 3. NASA JPL Horizons Ephemeris Integration

NASA JPL Horizons provides high-precision ephemerides based on the DE440/DE441 planetary models.
To determine Sun and Earth positions:
1. Target ID: `10` (Sun) and `399` (Earth).
2. Observer Center: `301` (Moon Center) or topocentric surface observer coordinate.
3. Coordinate System: Selenographic IAU frame or ICRF converted to lunar body-fixed frame.
4. Output Quantities: Vector components $[X, Y, Z]$ or directly calculated topocentric $[Az, El, \text{Range}]$.
5. Step size and temporal interpolation: Cubic spline interpolation across Horizons discrete grid points over the mission duration window.

---

## 4. Lunar Topography & LOLA Terrain Horizon Ray Tracing

At the Lunar South Pole, the Sun never rises high in the sky; its maximum elevation angle above the mean horizontal plane rarely exceeds $1.5^\circ$ to $1.8^\circ$ throughout the 18.6-year lunar nodal cycle. Consequently, topographic features (crater rims, ridges, massifs) located tens of kilometers away easily occult the Sun.

### 4.1 Lunar Curvature Correction
For a terrain feature at ground arc distance $s$ along the lunar surface from the observer:
The elevation drop due to lunar spherical curvature is:
$$\Delta h_{curv} = R_{moon} \left(1 - \cos\left(\frac{s}{R_{moon}}\right)\right) \approx \frac{s^2}{2 R_{moon}}$$

At $s = 30\text{ km}$:
$$\Delta h_{curv} \approx \frac{30,000^2}{2 \times 1,737,400} \approx 259\text{ meters}$$

### 4.2 Local Terrain Horizon Angle
Let:
- $h_0$ = observer ground elevation + observer mast/antenna height $h_{obs}$
- $h(s)$ = terrain elevation at distance $s$ along azimuth $\theta$

The geometric horizon elevation angle $\alpha(s)$ subtended by terrain point $s$ is:
$$\tan \alpha(s) = \frac{h(s) - h_0 - \Delta h_{curv}}{s}$$

The local terrain horizon mask $H(\theta)$ in direction $\theta$ is the maximum subtended angle over all distances $s \in [s_{min}, s_{max}]$:
$$H(\theta) = \max_{s \in [s_{min}, s_{max}]} \arctan\left(\frac{h(s) - h_0 - \frac{s^2}{2 R_{moon}}}{s}\right)$$

### 4.3 Solar & Earth Visibility Criteria
- **Solar Illumination**:
  The Sun has an angular semi-diameter $\delta_{sun} \approx 0.267^\circ$ ($16$ arcmin).
  - Fully Sunlit: $El_{sun} - \delta_{sun} > H(Az_{sun})$
  - Partial Sunlit (Penumbra): $H(Az_{sun}) - \delta_{sun} < El_{sun} < H(Az_{sun}) + \delta_{sun}$
  - Umbra (Total Shadow): $El_{sun} + \delta_{sun} < H(Az_{sun})$

- **Earth Visibility (Line of Sight)**:
  The Earth subtends an angular diameter of $\sim 1.9^\circ$.
  - Direct Line of Sight (DTE): $El_{earth} > H(Az_{earth})$
  - Occulted / Blocked: $El_{earth} \le H(Az_{earth})$

---

## 5. Earth Communication & Lunar Libration

Because the Moon's orbit is eccentric ($e \approx 0.0549$) and inclined to the ecliptic by $\sim 5.14^\circ$, an observer at the Lunar South Pole sees the Earth oscillate in the sky:
- **Libration in Latitude**: $\sim \pm 6.7^\circ$
- **Libration in Longitude**: $\sim \pm 7.9^\circ$
- Period: Draconic month ($\sim 27.21$ days) and anomalistic month ($\sim 27.55$ days).

At latitude $-89.5^\circ$, the Earth oscillates roughly between $-6^\circ$ and $+6^\circ$ in elevation.
When Earth dips below the local terrain horizon, direct-to-Earth communication is severed unless a lunar orbital relay (e.g. Lunar Gateway, Lunar Communications Relay) is available.

---

## 6. Mission Energy & Battery State-of-Charge (SoC) Simulation

### 6.1 3D Solar Power Generation Physics
Solar irradiance at 1 AU is $S_0 = 1361.0\text{ W/m}^2$.
For a solar array with area $A$, base efficiency $\eta$, regolith dust obscuration factor $\eta_{\text{dust}} \in [0, 1]$, and cell temperature derating factor $\eta_{\text{thermal}} \in [0, 1]$:

$$P_{gen}(t) = S_0 \cdot A \cdot \eta \cdot \max(0, \cos\theta_{inc}(t)) \cdot \eta_{\text{dust}} \cdot \eta_{\text{thermal}} \cdot \mathbb{I}_{\text{terrain\_sunlit}}(t)$$

#### 3D Vector Incidence Angle Formulation
In topocentric observer coordinates (East $\hat{e}$, North $\hat{n}$, Zenith $\hat{u}$):
- Sun unit vector at elevation $El$ and azimuth $Az$:
  $$\hat{\rho}_{sun} = (\cos El \sin Az, \cos El \cos Az, \sin El)$$
- Panel normal unit vector with tilt $\beta$ ($0^\circ = \text{horizontal flat}, 90^\circ = \text{vertical}$) and compass azimuth $\alpha$:
  $$\hat{n}_{panel} = (\sin\beta \sin\alpha, \sin\beta \cos\alpha, \cos\beta)$$
- Taking the inner product yields the true 3D cosine incidence angle:
  $$\cos\theta_{inc} = \hat{n}_{panel} \cdot \hat{\rho}_{sun} = \sin(El)\cos(\beta) + \cos(El)\sin(\beta)\cos(Az - \alpha)$$

- **Tracking Modes**:
  1. **Vertical Azimuth-Tracking Panel ($\beta = 90^\circ$, $\alpha = Az$)**:
     $$\cos\theta_{inc} = \cos(El_{sun})$$
     Because the lunar polar Sun orbits near the horizon ($El \approx 1.5^\circ$), $\cos(1.5^\circ) \approx 0.9997$ (nearly 100% optimal flux capture!).
  2. **Horizontal Flat Panel ($\beta = 0^\circ$)**:
     $$\cos\theta_{inc} = \sin(El_{sun})$$
     Yields only $\sin(1.5^\circ) \approx 0.026$ (over 97% cosine loss in polar grazing light).
  3. **Fixed Tilted/Vertical Panel**:
     Evaluates exact $(Az - \alpha)$ cosine azimuth variation as the Sun revolves $360^\circ$ over the 29.5-day synodic lunar day.

### 6.2 Battery State of Charge (SoC) & C-Rate Dynamics
Let $P_{load}(t) = P_{hotel} + P_{payload} + P_{heater}(t)$ be the total active power demand, where survival heaters engage when the lander is in shadow ($\mathbb{I}_{shadow} = 1$).

$$\Delta P(t) = P_{gen}(t) - P_{load}(t)$$

Battery energy update accounts for dual-path charging and discharging efficiencies ($\eta_{chg}, \eta_{dis}$) and maximum C-rate power limitations ($P_{c\_max} = C_{wh} \times C_{rate}$):
- When surplus power is generated ($\Delta P > 0$):
  $$P_{charge}(t) = \min(\Delta P(t), P_{charge\_c\_rate\_max})$$
  $$\Delta E_{stored}(t) = P_{charge}(t) \cdot \Delta t \cdot \eta_{chg}$$
- When net deficit occurs ($\Delta P < 0$):
  $$P_{discharge}(t) = \min(|\Delta P(t)|, P_{discharge\_c\_rate\_max})$$
  $$\Delta E_{stored}(t) = -\frac{P_{discharge}(t) \cdot \Delta t}{\eta_{dis}}$$

$$E_{stored}(t + \Delta t) = \text{clamp}\left(E_{stored}(t) + \Delta E_{stored}(t), 0, E_{capacity}\right)$$
$$\text{SoC}(t) = \frac{E_{stored}(t)}{E_{capacity}} \times 100\%$$

*Model Disclaimer*: An isothermal battery cell temperature environment is assumed nominal. Flight-qualification cryogenic thermal modeling and active radioisotope heating are required for deep-cryogenic ($<100\text{ K}$) lunar night survival.

---

## 7. Direct-to-Earth (DTE) RF Link Budget Assessment

Evaluating radio communication feasibility requires separating geometric line-of-sight clearance from electromagnetic link viability.

### 7.1 Free Space Path Loss (FSPL)
Over lunar distance $d_{\text{km}} \approx 384,400\text{ km}$ at carrier frequency $f_{\text{ghz}}$ (e.g. 2.2 GHz S-band or 8.4 GHz X-band):
$$\text{FSPL}(\text{dB}) = 92.45 + 20\log_{10}(d_{\text{km}}) + 20\log_{10}(f_{\text{ghz}})$$

### 7.2 Received Power and Link Margin
The received power at the Deep Space Network (DSN) ground terminal is:
$$P_{rx}(\text{dBm}) = P_{tx}(\text{dBm}) + G_{tx}(\text{dBi}) - \text{FSPL}(\text{dB}) + G_{rx}(\text{dBi}) - L_{sys}(\text{dB})$$
Where:
- $P_{tx}(\text{dBm}) = 10\log_{10}(P_{tx}(\text{W}) \times 1000)$
- $G_{tx}$ = Lander High/Medium Gain Antenna (MGA/HGA) directional gain
- $G_{rx}$ = DSN 34m/70m receiver antenna gain ($\sim 56\text{ dBi}$)
- $L_{sys}$ = Cable, polarization, and atmospheric attenuation losses ($\sim 3.0\text{ dB}$)

The link margin over receiver sensitivity threshold $P_{rx,min}$ (typically $-120\text{ dBm}$) is:
$$\text{Margin}(\text{dB}) = P_{rx} - P_{rx,min}$$

### 7.3 Antenna Pointing Constraints
RF communication is declared feasible only when:
1. Geometric line of sight is clear: $El_{earth} > H(Az_{earth})$.
2. Earth elevation falls within antenna gimbal pointing limits: $\theta_{min} \le El_{earth} \le \theta_{max}$ (e.g. $0.5^\circ \le El \le 85.0^\circ$).
3. Link margin satisfies mission threshold: $\text{Margin} \ge \text{Margin}_{req}$ (typically $3.0\text{ dB}$).

---

## 8. Multi-Criteria Decision Analysis (MCDA) Scoring

To rank landing sites without subjective bias, a 6-criteria normalized weighted sum model is employed:
$$Score(site) = \sum_{k=1}^{6} w'_k \cdot S_k(site)$$
Where weights are L1 normalized: $w'_k = \frac{w_k}{\sum_{j=1}^6 w_j}$.

The 6 operational criteria are:
1. $S_{illum}$: Cumulative illumination percentage over mission duration ($0-100$).
2. $S_{comm}$: Direct-to-Earth line-of-sight availability percentage ($0-100$).
3. $S_{slope}$: Terrain touchdown slope safety: $S_{slope} = \max\left(0, 1 - \frac{\theta_{slope}}{\theta_{max}}\right) \times 100$.
4. $S_{elev}$: Elevation advantage relative to regional topographic extrema ($0-100$).
5. $S_{power}$: Power survival metric: $100\%$ if min SoC remains above safe threshold; penalized proportionally if battery enters critical deficit or depletes ($0-100$).
6. $S_{blackout}$: Communication blackout risk mitigation: $100\%$ for zero blackout, penalized linearly as continuous blackout approaches threshold ($0-100$).

Hard operational constraints disqualify any site that violates user-configured safety envelopes (minimum illumination, minimum communication, maximum slope, maximum shadow hours, maximum blackout hours, or battery depletion).
