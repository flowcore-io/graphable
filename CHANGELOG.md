# Changelog

## [1.2.5](https://github.com/flowcore-io/graphable/compare/v1.2.4...v1.2.5) (2026-01-20)


### Bug Fixes

* add nativeButton prop to Button components with render prop ([e36b603](https://github.com/flowcore-io/graphable/commit/e36b6033f5006c779120963087159e5bc95d8596))
* prevent error information leakage in data sources page ([2c07e89](https://github.com/flowcore-io/graphable/commit/2c07e89c815e5f3cf12b87ea07cc370e8ea33c46))

## [1.2.4](https://github.com/flowcore-io/graphable/compare/v1.2.3...v1.2.4) (2026-01-20)


### Bug Fixes

* remove audience parameter from Keycloak config to fix production auth ([5e8e654](https://github.com/flowcore-io/graphable/commit/5e8e654fd678cc41b9f2d8366afdaeff2d1fd643))

## [1.2.3](https://github.com/flowcore-io/graphable/compare/v1.2.2...v1.2.3) (2026-01-20)


### Bug Fixes

* add /health endpoint for Kubernetes probes ([b203bdc](https://github.com/flowcore-io/graphable/commit/b203bdc47b848871237a85294b74c3599ae7be22))
* enable PKCE for Keycloak OAuth to prevent invalid_grant errors ([61b8509](https://github.com/flowcore-io/graphable/commit/61b8509a6738c8bd5ab0ea42f6a6589ec5493373))


### Reverts

* remove /health endpoint, use /api/health via manifest update ([9fa36a6](https://github.com/flowcore-io/graphable/commit/9fa36a6955b8f65e4f8f7d57e1549bb332f7f0ba))

## [1.2.2](https://github.com/flowcore-io/graphable/compare/v1.2.1...v1.2.2) (2026-01-20)


### Bug Fixes

* exclude /api/health from middleware for k8s health checks ([3647625](https://github.com/flowcore-io/graphable/commit/36476251e9364a737bd87c6712c9a9aa2a3d9128))

## [1.2.1](https://github.com/flowcore-io/graphable/compare/v1.2.0...v1.2.1) (2026-01-20)


### Bug Fixes

* **auth:** Enhance NextAuth.js handlers with error logging and improve redirect logic ([5080bce](https://github.com/flowcore-io/graphable/commit/5080bce26739cfbb9b3e99e8bfb2503f43a7c6c3))
* Update linter rules and enhance Azure configuration scripts ([0b7f97f](https://github.com/flowcore-io/graphable/commit/0b7f97f6b971de64009b83bb2cda14668d766860))

## [1.2.0](https://github.com/flowcore-io/graphable/compare/v1.1.0...v1.2.0) (2026-01-20)


### Features

* Add public test page and enhance authentication error handling ([c37b373](https://github.com/flowcore-io/graphable/commit/c37b373722cb9106d2bca66a8c5cb59c910774e0))

## [1.1.0](https://github.com/flowcore-io/graphable/compare/v1.0.0...v1.1.0) (2026-01-08)


### Features

* Clean up and optimize project files ([1d6d19f](https://github.com/flowcore-io/graphable/commit/1d6d19f51d4280b026717c9bbe15e46a6f09fd0f))
* Implement dashboard description field and enhance API routes ([b7c4255](https://github.com/flowcore-io/graphable/commit/b7c425536dd518abf072ef7c6bcd450fafbf102e))
* Implement secret management and data source support with Azure Key Vault ([990b119](https://github.com/flowcore-io/graphable/commit/990b119ecea33fcf079bc11b9118a98ea76d2756))
* Implement SQL query validation and enhance security measures ([710ecde](https://github.com/flowcore-io/graphable/commit/710ecde98ed012e87b519c79cdfea7b90389d166))


### Bug Fixes

* Enhance data source secret management and recovery process ([58fc6ad](https://github.com/flowcore-io/graphable/commit/58fc6add946a5c4b7aa4f9e4d2eb3bc866097e52))
* Enhance graph preview and execution handling ([71ba626](https://github.com/flowcore-io/graphable/commit/71ba626fe47cc503181881a08ab83e21d31e896f))
* Implement structured logging service for improved error tracking ([806a173](https://github.com/flowcore-io/graphable/commit/806a1731014a32bffdd4f8c8ffdd912cd2cd351c))
* Standardize request handling and improve type safety in scripts ([7953ac0](https://github.com/flowcore-io/graphable/commit/7953ac055a258144740e752921f6bc876f35af47))
* Standardize request parameter naming in API routes ([fe1053c](https://github.com/flowcore-io/graphable/commit/fe1053cbe26956952abe4eafa1874716db1ae3c6))
* Update API routes and validation logic ([085ea61](https://github.com/flowcore-io/graphable/commit/085ea61a43424417ece478b6afbeea04272544b6))
* Update HelmChart image version handling in CI workflow ([ce3bbdf](https://github.com/flowcore-io/graphable/commit/ce3bbdf10bc2ebd8429b3866364cc1c68cb39e49))
* Update UI components and improve data handling ([a4068ae](https://github.com/flowcore-io/graphable/commit/a4068ae302141c9f1c0358264fadb8a8814e926f))

## 1.0.0 (2025-12-15)


### Features

* Add Docker support and enhance environment management ([0bf7ba0](https://github.com/flowcore-io/graphable/commit/0bf7ba0fe4ba07b8d7153a4bb99bcd75094520c4))
* Enhance configuration and workspace management for Graphable ([5da65f1](https://github.com/flowcore-io/graphable/commit/5da65f1b1df61cad8d32c973644e1a4538b0c599))
* Enhance Docker support and CI/CD pipeline ([945b2e8](https://github.com/flowcore-io/graphable/commit/945b2e8fca7ba26864f985b16e9c4b46eaa2d03e))
* Integrate Flowcore and enhance workspace management ([9cf55c4](https://github.com/flowcore-io/graphable/commit/9cf55c4f4d5dd094900f29fb6e002da1f83441f0))
* Set up Docker environment and enhance project structure ([be0d908](https://github.com/flowcore-io/graphable/commit/be0d9088daf3561da80be98e6fb308833cc52fe5))
