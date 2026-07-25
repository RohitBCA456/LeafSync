# LeafSync Backend API

LeafSync is a role-based agritech supply chain and network management backend designed to streamline vertical farming logistics operations across four distinct organizational tiers: Administrators, Managers, Drivers, and Small Tower Growers (STG).

The platform serves as the central operational backbone for coordinating hydroponic tower yield reporting, driver dispatching, regional supervision, and platform administration through a strictly partitioned RESTful API architecture.

## System Workflows

LeafSync coordinates multi-party operations within an agritech supply network by providing dedicated workflows tailored to each participant's role:

                  +------------------------------+
                  |         System Admin         |
                  | (Platform Control & Audits)  |
                  +--------------+---------------+
                                 |
           +---------------------+---------------------+
           |                                           |
           v                                           v
+----------------------+                   +----------------------+
|   Regional Manager   |                   |  Small Tower Grower  |
| (Dispatch & Metrics) |                   |  (Harvest & Yields)  |
+----------+-----------+                   +----------------------+
           |
           v
+----------------------+
|   Transport Driver   |
| (Produce Collection) |
+----------------------+

## Core Operational Domains

### Small Tower Grower (STG) Operations

Small Tower Growers represent local vertical farm owners or hydroponic/aeroponic tower operators within the supply network.

- **Yield and Production Logging:** Tracks harvest batches, tower health metrics, crop readiness, and produce availability for pickup.
- **Account Provisioning:** Dedicated registration and verification flows for individual tower sites and farm operators.

### Driver and Fleet Management

Drivers execute collection and delivery operations between grower sites, distribution hubs, and end buyers.

- **Onboarding and Verification:** Captures driver credentials, licensing metadata, contact details, and vehicle transport capacities.
- **Status Updates:** Real-time status reporting for driver availability, scheduled farm pickups, and route execution.

### Managerial Oversight

Regional managers oversee tower production metrics, driver availability, and harvest collection schedules.

- **Operational Dashboards:** Provides access to real-time harvest yields, pending pickup requests, and grower activity across regions.
- **Workflow Control:** Assigns drivers to specific grower locations to prevent harvest spoilage and transit delays.

### Admin Governance

Admins maintain global security, system configurations, and platform integrity.

- **Privileged Account Creation:** Controls internal user creation (Admins and Managers) to prevent unauthorized public registration.
- **System Auditing:** Broad oversight across all active growers, drivers, routes, and operational domains.

## Architecture and Data Handling

- **Domain-Isolated Controllers:** Separate registration and operational endpoints for each role prevent mixed concerns and enforce strict permission boundaries.
- **Unified Response Standard:** Every request returns a standardized JSON structure with consistent success indicators, message bodies, and typed payloads.
- **Centralized Error Handling:** Global exception interception catches runtime failures and database constraints, returning clean HTTP error responses.
- **Data Integrity and Security:** Database interactions utilize parameterized queries to protect against SQL injection, alongside salted password hashing for credential management.