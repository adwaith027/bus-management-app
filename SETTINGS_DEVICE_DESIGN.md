# Settings & Device Configuration — Design Document

**Project:** TicketingApp (Django REST + React)
**Scope:** Per-device settings, profiles, palmtec ID assignment, BUS.DAT download flow
**Date:** 2026-05-07
**Status:** Design finalised — not yet implemented

---

## 1. Context

The Palmtec ETM (Electronic Ticket Machine) is a physical bus ticketing device. Each device runs
firmware that reads a binary config file called `BUS.DAT` when it boots. The web app is responsible
for generating and serving this file.

There are two levels of configuration:

| Level | Owner | Description |
|---|---|---|
| Company Settings | Company Admin (via MDB import) | Baseline config for the whole company |
| Settings Profile | Company Admin (manually) | Per-device override; linked to a specific device via palmtec_id |

---

## 2. Actor Hierarchy

```
Superadmin (web app creator's employee)
  └── manages ETMDevice records (serial numbers, allocation, dealer assignment)
      └── Excel/CSV import populates ETMDevice table — superadmin territory only

Company Admin (client company's staff)
  └── manages Settings (imported from MDB)
  └── manages DevicePalmtecMap (assigns palmtec IDs to their allocated devices)
  └── manages SettingsProfile (named configs, each linked to one device via palmtec_id)
```

**Critical boundary:** The `ETMDevice` table is superadmin-owned. Company admins must never write
to it directly. All company-admin device configuration lives in separate models they own.

---

## 3. Existing Models (Current State)

### 3.1 `Settings` — `db_table: mdb_settings`

One record per company. Populated by MDB file import (superadmin or company admin triggers import).
This is the company-wide baseline — all devices fall back to this if no profile is assigned.

**Key fields:**
```
user_pwd, master_pwd
half_per, con_per, phy_per, round_amt, luggage_unit_rate
st_max_amt, st_min_con, st_roundoff_enable, st_roundoff_amt, st_fare_edit
main_display, main_display2, header1, header2, header3, footer1, footer2
roundoff, round_up, remove_ticket_flag, stage_font_flag, next_fare_flag
odometer_entry, ticket_no_big_font, crew_check, gprs_enable
tripsend_enable, schedulesend_enable, sendpend, inspect_rpt
multiple_pass, simple_report, inspector_sms, auto_shut_down, userpswd_enable
report_flag, language_option, stage_updation_msg, default_stage, report_font
ph_no2, ph_no3, access_point, dest_adds, username, password
uploadpath, downloadpath, http_url
smart_card, exp_enable, ftp_enable, gprs_enable_message, sendbill_enable
currency
company (OneToOneField → Company)
```

### 3.2 `SettingsProfile` — `db_table: settings_profiles`

Named configuration template. Multiple per company. Each profile is intended for one device,
identified by `palmtec_id`. Has the same config fields as `Settings` plus `name` and `palmtec_id`.

**Key fields:**
```
company (FK → Company)
name (CharField, unique per company)
palmtec_id (PositiveIntegerField, nullable) ← the device this profile is for

# Same config fields as Settings:
user_pwd, master_pwd
half_per, con_per, phy_per, round_amt, luggage_unit_rate
main_display, main_display2, header1–3, footer1–2
language_option, report_font
st_fare_edit, st_max_amt, st_ratio, st_min_amt
st_roundoff_enable, st_roundoff_amt
roundoff, round_up, remove_ticket_flag, stage_font_flag, next_fare_flag
odometer_entry, ticket_no_big_font, crew_check
tripsend_enable, schedulesend_enable, inspect_rpt
multiple_pass, simple_report, inspector_sms, auto_shut_down, userpswd_enable
exp_enable, stage_updation_msg, default_stage
created_at, created_by, updated_at, updated_by
```

**Constraint:** `unique_together = [('company', 'name')]`

### 3.3 `ETMDevice` — `db_table: etm_device`

Hardware registry. Superadmin-owned. Populated by Excel import. Company admins never write here.

**Key fields:**
```
serial_number (unique)
device_type (ETM | ANDROID)
company (FK → Company, nullable)
dealer (FK → Dealer, nullable)
allocation_status (Stock | DealerPool | Allocated | Inactive)
created_by, created_at, updated_at
```

**Note:** No `palmtec_id` here — that is a company-admin concern and lives in `DevicePalmtecMap`.

---

## 4. New Model Required — `DevicePalmtecMap`

**Why a separate model:**
`ETMDevice` is the hardware registry (superadmin territory). `palmtec_id` is what the client company
calls that device in their own system — a company-admin assignment. These belong to different owners
and must not be mixed. A separate model maintains this boundary cleanly, and also handles the case
where a device is reallocated (the old company's palmtec assignment can be cleanly removed without
touching the `ETMDevice` record).

**Proposed model:**
```python
class DevicePalmtecMap(models.Model):
    company   = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='device_palmtec_maps')
    device    = models.ForeignKey(ETMDevice, on_delete=models.CASCADE, related_name='palmtec_maps')
    palmtec_id = models.PositiveIntegerField(null=True, blank=True,
                    help_text="Client-assigned device identifier (max 6 digits)")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'device_palmtec_map'
        unique_together = [('company', 'device'), ('company', 'palmtec_id')]
```

**Who populates it:**
- Records are created automatically when a device is allocated to a company (palmtec_id = null)
- Company admin assigns the palmtec_id from their web dashboard device section

---

## 5. Intended Design Flow

### 5.1 Full Settings Configuration Flow

```
1. MDB Import
   └── Populates / updates Settings table (one record per company)
       └── This is the company-wide baseline

2. Device Palmtec Assignment (Company Admin — Web Dashboard)
   └── Company admin opens "Devices" section
   └── Sees list of all their allocated ETMDevices (serial number)
   └── Assigns a palmtec_id to each device → stored in DevicePalmtecMap
   └── palmtec_id is a 6-digit numeric identifier the client uses internally

3. Profile Creation (Company Admin — Web Dashboard)
   └── Company admin creates a named Settings Profile
   └── Form prefills all config fields from company's Settings record (as defaults)
   └── Admin adjusts values as needed for this specific device
   └── palmtec_id field is a DROPDOWN populated from DevicePalmtecMap
       (only shows devices that have a palmtec_id assigned)
   └── Profile saved → linked to that device via palmtec_id

4. BUS.DAT Download (APK / USB transfer to physical device)
   └── APK opens the download screen
   └── DEVICE SELECTOR DROPDOWN (similar to route selector):
       Lists all company devices that have an assigned palmtec_id
       Display: "Serial Number — PalmtecID" (source: DevicePalmtecMap JOIN ETMDevice)
   └── User selects which device this download is for
   └── Server receives palmtec_id from selection
   └── Server looks up SettingsProfile with matching palmtec_id for this company
       └── If found → build BUS.DAT from profile's field values
       └── If not found → fall back to company-level Settings (BUS.DAT from Settings)
   └── Binary BUS.DAT served as download
```

### 5.2 Web Dashboard Device Section UI

Located under company admin's tools/management area.

- Table listing all `ETMDevice` records allocated to this company
- Columns: Serial Number | Device Type | Palmtec ID | Actions
- Default state: Palmtec ID column shows `—` (not assigned)
- "Edit" action opens inline field to type/assign a palmtec_id
- On save → creates or updates `DevicePalmtecMap` record for that device
- This list is the source of truth for the palmtec_id dropdown in profile creation

### 5.3 Profile Page UI

- Profile list shows all `SettingsProfile` records for the company
- "Create Profile" / "Edit Profile" form:
  - Name field
  - Palmtec ID → **dropdown** (not free text), populated from `DevicePalmtecMap` where `palmtec_id IS NOT NULL`
  - All config fields (prefilled from `Settings` when creating a new profile)
  - Save / Update button

---

## 6. API Endpoints

### 6.1 Existing — Keep As-Is

| Method | URL | View | Notes |
|---|---|---|---|
| GET/PUT | `/masterdata/settings` | `get_settings` | Company-level Settings CRUD |
| GET | `/masterdata/device-settings/devices` | `list_company_devices` | Device picker list for DeviceSettingsTab |
| GET | `/masterdata/settings-profiles` | `list_profiles` | All profiles for company |
| POST | `/masterdata/settings-profiles/create` | `create_profile` | Create new profile |
| PUT/DELETE | `/masterdata/settings-profiles/<profile_id>` | `profile_detail` | Edit/delete profile |

### 6.2 Existing — Needs Update

| Method | URL | Current Problem | Fix |
|---|---|---|---|
| GET | `/device/settings` | Reads from company `Settings` only — not device-aware | Add `?palmtec_id=` param support; look up `SettingsProfile` first |

### 6.3 New Endpoints Required

#### DevicePalmtecMap CRUD (Company Admin)

| Method | URL | Purpose |
|---|---|---|
| GET | `/masterdata/device-palmtec-map` | List all devices (from ETMDevice allocated to company) with their palmtec_id from DevicePalmtecMap |
| PUT | `/masterdata/device-palmtec-map/<device_id>` | Assign or update palmtec_id for a device |

#### Updated Settings Download

| Method | URL | Change |
|---|---|---|
| GET | `/device/settings?palmtec_id=<id>` | Add optional `palmtec_id` query param; if provided, look up matching SettingsProfile and build BUS.DAT from it instead of company Settings |

#### Profile Palmtec Dropdown

| Method | URL | Purpose |
|---|---|---|
| GET | `/masterdata/dropdowns/palmtec-devices` | Returns `[{palmtec_id, serial_number, device_id}]` for devices that have a palmtec_id assigned — used to populate profile creation dropdown |

---

## 7. BUS.DAT Generation Logic (Updated)

**File:** `Backend/TicketAppB/views/palmtec_data_views.py` → `get_settings_file()`

**Current logic:**
```python
s = Settings.objects.get(company=company)
binary = _pack_busdat(s)
```

**Intended logic:**
```python
palmtec_id = request.GET.get('palmtec_id')
if palmtec_id:
    profile = SettingsProfile.objects.filter(company=company, palmtec_id=palmtec_id).first()
    if profile:
        binary = _pack_busdat(profile)   # profile has same fields as Settings
    else:
        # no profile for this palmtec_id — fall back to company defaults
        s = Settings.objects.get(company=company)
        binary = _pack_busdat(s)
else:
    # no device selected — serve company defaults
    s = Settings.objects.get(company=company)
    binary = _pack_busdat(s)
```

`_pack_busdat()` already accepts any object with the right field names — both `Settings` and
`SettingsProfile` have the same fields, so no change to the packer function is needed.

---

## 8. Frontend — DeviceSettingsTab (SettingsPage.jsx)

**Intended behaviour (to implement):**
The `DeviceSettingsTab` should not load a separate per-device settings record. Instead:
- Left panel: device list (from `/masterdata/device-settings/devices`)
- Selecting a device fetches the `SettingsProfile` assigned to that device
  - Lookup: find `DevicePalmtecMap` for selected device → get `palmtec_id` → find `SettingsProfile`
    with that `palmtec_id`
  - If found → show that profile's fields (editable)
  - If not found → show the normal company-level Settings page (same as the Company Settings tab)
    Profile section is also visible, but the palmtec_id dropdown will be empty since no devices
    have palmtec_ids assigned yet
- "Apply Profile" button → links a chosen profile to the device by updating `DevicePalmtecMap`
  (sets the `palmtec_id` on the map record to match the profile's `palmtec_id`)
- "Save" → PUT to `/masterdata/settings-profiles/<profile_id>` (existing endpoint)

---

## 9. Migration Plan (When Implementing)

1. Create `DevicePalmtecMap` model + migration
2. Auto-create `DevicePalmtecMap` records (palmtec_id=null) for all existing allocated devices
3. Add `DevicePalmtecMap` CRUD endpoints (backend)
4. Add palmtec dropdown endpoint for profile creation (backend)
5. Build Device Management section in web dashboard (frontend)
6. Update Profile creation — palmtec_id becomes dropdown (frontend)
7. Update `get_settings_file` to accept `?palmtec_id=` and serve profile data (backend)
8. Rework `DeviceSettingsTab` to use profile-based flow (frontend)

---

## 10. File Reference

| File | Role |
|---|---|
| `Backend/TicketAppB/models/master_data.py` | `Settings`, `SettingsProfile` models |
| `Backend/TicketAppB/models/company.py` | `ETMDevice`, `Company` models |
| `Backend/TicketAppB/views/settings_views.py` | All settings + profile views |
| `Backend/TicketAppB/views/palmtec_data_views.py` | BUS.DAT + binary file generation |
| `Backend/TicketAppB/urls.py` | All URL patterns |
| `Frontend/src/pages/tools/SettingsPage.jsx` | Company settings + device settings + profile UI |
