"""
FastAPI In-Process Test Client for Sandboxed Environments
Dispatches directly to FastAPI routes, models, and endpoints without loopback socket requirements.
"""

import re
import urllib.parse
import inspect
from typing import Any, Dict, Optional
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.params import Param
from pydantic import BaseModel


class TestResponse:
    def __init__(self, status_code: int, data: Any):
        self.status_code = status_code
        self._data = data

    def json(self) -> Any:
        return self._data

    @property
    def text(self) -> str:
        if isinstance(self._data, str):
            return self._data
        import json
        return json.dumps(self._data)


class FastAPITestClient:
    """
    Lightweight, deterministic in-process test client for FastAPI.
    Avoids Windows socket loopback deadlocks in isolated sandbox test runners.
    """
    __test__ = False

    def __init__(self, app: Any):
        self.app = app
        self.flat_routes = []

        def collect(routes, prefix=""):
            for r in routes:
                if hasattr(r, "original_router"):
                    collect(r.original_router.routes, prefix + getattr(r.include_context, "prefix", ""))
                elif hasattr(r, "routes"):
                    collect(r.routes, prefix + getattr(r, "prefix", ""))
                else:
                    full_path = prefix + getattr(r, "path", "")
                    # Convert {param} to regex named group
                    pattern = re.sub(r"\{([^}]+)\}", r"(?P<\1>[^/]+)", full_path)
                    regex = re.compile(f"^{pattern}$")
                    self.flat_routes.append((full_path, regex, r))

        collect(app.routes)

    def request(self, method: str, url: str, json: Optional[Dict[str, Any]] = None) -> TestResponse:
        parsed = urllib.parse.urlparse(url)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        flat_query = {k: v[0] for k, v in query.items()}

        for full_path, regex, route in self.flat_routes:
            methods = getattr(route, "methods", set())
            if method.upper() in methods:
                match = regex.match(path)
                if match:
                    path_params = match.groupdict()
                    kwargs = {**path_params, **flat_query}
                    endpoint = route.endpoint
                    sig = inspect.signature(endpoint)
                    call_kwargs = {}

                    for p_name, p in sig.parameters.items():
                        if p_name in kwargs:
                            val = kwargs[p_name]
                            if val == "None" or val == "":
                                call_kwargs[p_name] = None
                                continue

                            type_str = str(p.annotation).lower()
                            if "float" in type_str:
                                call_kwargs[p_name] = float(val)
                            elif "int" in type_str:
                                call_kwargs[p_name] = int(val)
                            elif "bool" in type_str:
                                call_kwargs[p_name] = val.lower() in ("true", "1", "yes")
                            else:
                                call_kwargs[p_name] = val
                        elif json is not None:
                            try:
                                call_kwargs[p_name] = p.annotation(**json)
                            except Exception:
                                pass
                        elif isinstance(p.default, Param):
                            call_kwargs[p_name] = p.default.default

                    try:
                        res = endpoint(**call_kwargs)
                        if isinstance(res, BaseModel):
                            res_dict = res.model_dump(mode="json")
                        elif hasattr(res, "dict"):
                            res_dict = res.dict()
                        else:
                            res_dict = jsonable_encoder(res)
                        return TestResponse(200, res_dict)
                    except HTTPException as exc:
                        return TestResponse(exc.status_code, {"detail": exc.detail})
                    except Exception as exc:
                        return TestResponse(500, {"detail": str(exc)})

        return TestResponse(404, {"detail": "Not Found"})

    def get(self, url: str) -> TestResponse:
        return self.request("GET", url)

    def post(self, url: str, json: Optional[Dict[str, Any]] = None) -> TestResponse:
        return self.request("POST", url, json=json)

    def put(self, url: str, json: Optional[Dict[str, Any]] = None) -> TestResponse:
        return self.request("PUT", url, json=json)

    def delete(self, url: str) -> TestResponse:
        return self.request("DELETE", url)
