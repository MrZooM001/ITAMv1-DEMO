# 🖥️ IT Asset Management System
### Enterprise-Grade IT Infrastructure Management Platform

> **Multi-Tenant SaaS** · **FastAPI + React** · **PostgreSQL** · **v1.0**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Core Features](#core-features)
- [Speccy Integration](#speccy-integration)

---

## Overview

**IT Asset Management System (ITAM)** is a comprehensive, enterprise-grade platform designed to give organizations complete visibility and control over their entire IT infrastructure.

Built from the ground up as a **multi-tenant SaaS**, the system enables IT teams to:

- Track and manage all hardware assets with full technical specifications
- Manage software installations and license compliance
- Handle incident tickets from creation to resolution
- Monitor inventory and spare parts stock
- Generate actionable reports for management and audits

A key differentiator is the **native CCleaner Speccy Report XML integration** — IT technicians can automatically import full hardware profiles from any Windows machine without a single line of manual data entry.

---

## Problem Statement

IT departments in mid-size organizations face a recurring set of operational challenges that reduce efficiency and increase risk:

| Pain Point | Impact |
|---|---|
| No centralized asset registry | Devices go untracked; duplication hardware insertion; IPv4 static addresses untracked; |
| duplicate IPs causes network conflicts and network errors; | audit failures | Manual hardware documentation |
| Time-consuming, error-prone, and quickly becomes outdated | Unmanaged software licenses | Scattered incident handling |
| No ticket history means repeated failures go undetected | No spare parts tracking |
| Technicians waste time searching; stockouts delay critical repairs |
| Lack of actionable reporting | Management has no visibility into IT health, costs, or trends |

---

## Core Features

### 🔧 Asset & Hardware Management
- Full device registry supporting PCs, Laptops, Servers, Printers, Scanners, and more
- **Auto-import hardware specs** from Speccy XML (CPU, RAM, Storage, GPU, Monitor, Network)
- Track device assignment by department and employee
- Monitor warranty expiry with automated alerts
- Device lifecycle management: `Active` · `In Maintenance` · `Retired`

### 📦 Software & License Management
- Company-wide software catalog with vendor and category tagging
- Track installed software per device with version history
- Manage license seats, types (Perpetual / Subscription / OEM), and expiry dates
- Distinguish between company-wide and department-specific software

### 🎫 Ticketing & Maintenance
- Issue tickets linked directly to devices and employees
- Priority levels: `Low` · `Medium` · `High` · `Critical`
- Full status workflow: `Open` → `In Progress` → `Resolved` → `Closed`
- Complete update history with technician notes per ticket
- Spare parts consumption linked to individual repair tickets

### 🗄️ Inventory & Spare Parts
- Track general IT inventory (accessories, consumables, hardware components)
- Dedicated spare parts module with device compatibility tagging
- Minimum quantity alerts to prevent stockouts
- Full traceability: spare parts usage tied to repair tickets

### 📊 Reporting & Export
- Built-in reports: asset inventory, warranty status, license utilization, ticket SLAs
- Export to **PDF** and **Excel**
- Department-level and company-wide views

### 💾 Backup & Restore
- Automated daily database backups
- Configurable retention policy
- One-click restore from the admin dashboard

---

## Speccy Integration

One of the system's key differentiators is its native integration with **CCleaner Speccy**, a hardware profiling tool for Windows.

Instead of manually entering hardware details for each machine, IT technicians:
1. Run Speccy on the target device
2. Export the XML report
3. Upload it to the ITAM system

The system automatically parses and stores the full hardware profile.

### Data Extracted from Speccy XML

| Component | Fields Captured |
|---|---|
| **CPU** | Model, Cores, Threads, Base Speed (MHz) |
| **Motherboard** | Manufacturer, Model, BIOS Version, BIOS Date |
| **RAM** | Total GB, Type, Speed (MHz), Slots used/total · Per module: Manufacturer, Part No., Serial, Speed |
| **Storage** | Per disk: Model, Manufacturer, Capacity (GB), Interface (SATA/NVMe), Type (SSD/HDD), Serial, SMART Status |
| **GPU** | Manufacturer, Model |
| **Monitor** | Manufacturer *(derived from Device Tree)*, Model, Resolution, Refresh Rate (Hz) |
| **Network** | Ethernet & Wi-Fi only: Adapter, MAC, IP Address(es), Subnet Mask, Gateway, DHCP status |
| **OS** | Name, Version, Architecture, Installation Date |

> ⚠️ **Virtual adapters** (VMware, VPN clients, security software, etc.) are automatically excluded during parsing. Only physical Ethernet and Wi-Fi adapters are imported.
