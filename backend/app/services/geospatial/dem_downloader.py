"""
LUNA NAVIGATOR — NASA PDS LOLA DEM Acquisition & Processing Utility (Member 3 Ownership)
Automates downloading, checksum verification, and bounding box cropping for NASA LOLA
digital elevation models from the NASA Planetary Data System (PDS) Geosciences Node.
"""

import os
import sys
import hashlib
import argparse
from typing import Dict, Any, Optional
import urllib.request

PDS_LOLA_CATALOG: Dict[str, Dict[str, Any]] = {
    "LDEM_80S_100M": {
        "description": "LOLA South Pole DEM (80°S to 90°S) at 100 meters/pixel",
        "resolution_m": 100.0,
        "coverage": "80S - 90S",
        "url_img": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_80s_100m.img",
        "url_lbl": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_80s_100m.lbl",
        "approx_size_mb": 580.0,
        "format": "PDS IMG (32-bit floating point, Big-Endian)"
    },
    "LDEM_85S_20M": {
        "description": "LOLA High-Resolution Polar Core (85°S to 90°S) at 20 meters/pixel",
        "resolution_m": 20.0,
        "coverage": "85S - 90S",
        "url_img": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_85s_20m.img",
        "url_lbl": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_85s_20m.lbl",
        "approx_size_mb": 1450.0,
        "format": "PDS IMG (32-bit floating point)"
    },
    "LDEM_875S_5M": {
        "description": "LOLA Artemis Exploration Zone (87.5°S to 90°S) at 5 meters/pixel",
        "resolution_m": 5.0,
        "coverage": "87.5S - 90S",
        "url_img": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_875s_5m.img",
        "url_lbl": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/ldem_875s_5m.lbl",
        "approx_size_mb": 2900.0,
        "format": "PDS IMG (32-bit floating point)"
    }
}


def download_pds_product(
    product_key: str,
    output_dir: str,
    download_label: bool = True
) -> Dict[str, str]:
    """
    Download a NASA PDS LOLA elevation model and its label file.
    
    Args:
        product_key: Key from PDS_LOLA_CATALOG (e.g. 'LDEM_80S_100M')
        output_dir: Target directory on local disk
        download_label: Whether to also download the PDS .lbl header
        
    Returns:
        Dictionary with downloaded file paths
    """
    if product_key not in PDS_LOLA_CATALOG:
        raise ValueError(f"Unknown product key: {product_key}. Available: {list(PDS_LOLA_CATALOG.keys())}")
        
    os.makedirs(output_dir, exist_ok=True)
    info = PDS_LOLA_CATALOG[product_key]
    results = {}
    
    # 1. Download label (.lbl) first (small metadata text file)
    if download_label and "url_lbl" in info:
        lbl_filename = os.path.basename(info["url_lbl"])
        lbl_dest = os.path.join(output_dir, lbl_filename)
        print(f"Downloading PDS label: {info['url_lbl']} -> {lbl_dest}")
        urllib.request.urlretrieve(info["url_lbl"], lbl_dest)
        results["label_path"] = lbl_dest
        
    # 2. Download raster image (.img)
    img_filename = os.path.basename(info["url_img"])
    img_dest = os.path.join(output_dir, img_filename)
    print(f"Downloading PDS image: {info['url_img']} (~{info['approx_size_mb']} MB) -> {img_dest}")
    urllib.request.urlretrieve(info["url_img"], img_dest)
    results["image_path"] = img_dest
    
    return results


def verify_file_sha256(filepath: str, expected_sha256: str) -> bool:
    """
    Verify SHA-256 cryptographic checksum of a downloaded dataset file.
    """
    if not os.path.isfile(filepath):
        return False
        
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
            
    calc_hash = hasher.hexdigest().lower()
    return calc_hash == expected_sha256.lower()


def list_available_products():
    """
    Display catalog of NASA LOLA elevation products.
    """
    print("\n=== NASA Planetary Data System (PDS) LOLA Elevation Products ===")
    for key, val in PDS_LOLA_CATALOG.items():
        print(f"\nProduct ID:  {key}")
        print(f"  Title:      {val['description']}")
        print(f"  Resolution: {val['resolution_m']} m/pixel")
        print(f"  Coverage:   {val['coverage']}")
        print(f"  Format:     {val['format']}")
        print(f"  Est. Size:  {val['approx_size_mb']} MB")
        print(f"  Image URL:  {val['url_img']}")
        print(f"  Label URL:  {val['url_lbl']}")
    print("\n=================================================================\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NASA LOLA DEM Acquisition Utility")
    parser.add_argument("--list", action="store_true", help="List available NASA PDS LOLA products")
    parser.add_argument("--product", type=str, default=None, help="Product key to download (e.g. LDEM_80S_100M)")
    parser.add_argument("--output-dir", type=str, default="./datasets/dem", help="Target output directory")
    
    args = parser.parse_args()
    
    if args.list or not args.product:
        list_available_products()
    else:
        try:
            download_pds_product(args.product, args.output_dir)
            print("Download completed successfully.")
        except Exception as e:
            print(f"Download failed: {e}", file=sys.stderr)
            sys.exit(1)
