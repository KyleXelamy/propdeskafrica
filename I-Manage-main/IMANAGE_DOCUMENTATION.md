# I-MANAGE - Property Management System
## Complete Documentation & Technical Guide

**Version:** 1.0  
**Date:** 2025  
**Platform:** Next.js 15 + Supabase + Tailwind CSS + React  

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Feature Documentation](#feature-documentation)
6. [User Guide](#user-guide)
7. [Technical Setup](#technical-setup)
8. [API Documentation](#api-documentation)
9. [Security & Privacy](#security--privacy)
10. [Troubleshooting](#troubleshooting)

---

## EXECUTIVE SUMMARY

**I-Manage** is a comprehensive web-based property management system designed for landlords, property managers, and rental agencies in Kenya and East Africa. The platform centralizes all property management operations including tenant management, financial tracking, maintenance requests, and document storage.

### Key Features
- **Property Management**: Add and manage multiple properties with detailed information
- **Tenant Tracking**: Complete tenant database with lease management
- **Financial Management**: Track rent payments, expenses, and generate financial reports
- **Maintenance Management**: Log and track maintenance requests and repairs
- **Document Management**: Store and organize all property-related documents
- **Notes System**: Keep notes on properties, tenants, and general items
- **Reports & Analytics**: Generate comprehensive financial and operational reports
- **Mobile Responsive**: Fully optimized for desktop, tablet, and mobile devices

### Target Users
- Individual property owners
- Real estate agencies
- Property management companies
- Landlord associations

---

## SYSTEM OVERVIEW

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend Framework | Next.js | 15+ |
| UI Library | React | 19+ |
| Styling | Tailwind CSS | 4.0 |
| Authentication | Supabase Auth | Latest |
| Database | PostgreSQL (Supabase) | 15+ |
| ORM/Query Builder | Supabase JS Client | 2.0+ |
| Icons | Lucide React | Latest |
| UI Components | ShadCN/UI | Latest |
| Deployment | Vercel | - |

### System Requirements

**Client-Side:**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Minimum screen size: 320px (mobile) to 4K

**Server-Side:**
- Supabase account and project
- Vercel account for deployment (optional)

---

## ARCHITECTURE

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│              (Next.js 15 + React 19)                       │
│                   Browser-based UI                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Pages: Dashboard, Properties, Tenants,             │    │
│  │ Finances, Maintenance, Documents, Notes, Settings  │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↕
                    API Routes Layer
        /app/api/properties, /app/api/tenants, etc.
                          ↕
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYER                     │
│                    (Supabase Auth)                         │
│         Email/Password Authentication with JWT             │
└─────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                          │
│              (PostgreSQL via Supabase)                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Tables: properties, tenants, rent_payments,        │    │
│  │ expenses, maintenance_requests, documents,         │    │
│  │ notes, user_profiles                               │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Row Level Security (RLS) Policies                  │    │
│  │ - Users can only access their own data             │    │
│  │ - Automatic data isolation per user                │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram (DFD)

```
User Login
   ↓
Supabase Auth validates credentials
   ↓
JWT Token issued
   ↓
User accesses Dashboard
   ↓
Frontend requests data via API routes
   ↓
API routes validate JWT and user_id
   ↓
API routes query Supabase with RLS enforcement
   ↓
RLS policies restrict data to user's records only
   ↓
Data returned to frontend
   ↓
Frontend displays data in UI
   ↓
User creates/updates/deletes records
   ↓
API routes save changes to database
   ↓
RLS ensures only user's records are modified
   ↓
Changes reflected in UI
```

### Component Architecture

```
App Layout
│
├── Authentication Routes
│   ├── /auth/login
│   ├── /auth/sign-up
│   └── /auth/forgot-password
│
├── Dashboard Layout
│   ├── Sidebar Navigation
│   └── Main Content Area
│       ├── /dashboard (Overview)
│       ├── /dashboard/properties
│       │   ├── List view
│       │   ├── Add new
│       │   ├── View details
│       │   └── Edit
│       ├── /dashboard/tenants
│       │   ├── List view
│       │   ├── Add new
│       │   ├── View details
│       │   └── Edit
│       ├── /dashboard/finances
│       │   ├── Overview
│       │   ├── Payments
│       │   ├── Expenses
│       │   └── Reports
│       ├── /dashboard/maintenance
│       │   ├── List view
│       │   ├── Add request
│       │   └── Track progress
│       ├── /dashboard/documents
│       │   ├── Upload
│       │   ├── Organize
│       │   └── Download
│       ├── /dashboard/notes
│       │   ├── List view
│       │   └── Add notes
│       └── /dashboard/settings
│           ├── Profile
│           ├── Preferences
│           ├── Notifications
│           ├── Security
│           └── Data Export
│
└── API Routes
    ├── /api/properties
    ├── /api/tenants
    ├── /api/payments
    ├── /api/maintenance
    ├── /api/expenses
    ├── /api/documents
    └── /api/notes
```

---

## DATABASE SCHEMA

### Entity Relationship Diagram (ERD)

```
┌─────────────────────┐
│  auth.users         │
│  (Supabase Auth)    │
│                     │
│ id (UUID)           │
│ email               │
│ password (hashed)   │
└──────────┬──────────┘
           │
           │ References
           ↓
┌─────────────────────────────────────────────────────────────┐
│                    CORE TABLES                              │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ properties       │  │ user_profiles    │               │
│  ├──────────────────┤  ├──────────────────┤               │
│  │ id (PK)          │  │ id (PK)          │               │
│  │ user_id (FK)     │◄─┤ user_id (FK)     │               │
│  │ name             │  │ full_name        │               │
│  │ address          │  │ company_name     │               │
│  │ city             │  │ phone            │               │
│  │ county           │  │ timezone         │               │
│  │ type             │  │ currency         │               │
│  │ bedrooms         │  │ date_format      │               │
│  │ bathrooms        │  └──────────────────┘               │
│  │ rent_amount      │                                     │
│  │ amenities (TEXT)│                                     │
│  │ status          │                                     │
│  │ description     │                                     │
│  │ created_at      │                                     │
│  │ updated_at      │                                     │
│  └────────┬─────────┘                                     │
│           │                                               │
│           │ One property has many:                        │
│           ├─────────────────────────────────────┐         │
│           │                                     │         │
│      ┌────▼────────────┐  ┌──────────────┐  ┌──▼─────────┐│
│      │ tenants         │  │ maintenance  │  │ documents ││
│      ├─────────────────┤  │ _requests    │  ├───────────┤│
│      │ id (PK)         │  ├──────────────┤  │ id (PK)   ││
│      │ user_id (FK)    │  │ id (PK)      │  │ user_id   ││
│      │ property_id(FK) │◄─┤ user_id (FK) │  │ property  ││
│      │ full_name       │  │ property_id  │  │ _id (FK)  ││
│      │ email           │  │ (FK)         │  │ tenant_id ││
│      │ phone           │  │ tenant_id    │  │ (FK)      ││
│      │ national_id     │  │ (FK)         │  │ name      ││
│      │ lease_start     │  │ title        │  │ type      ││
│      │ lease_end       │  │ category     │  │ file_url  ││
│      │ status          │  │ priority     │  │ mime_type ││
│      │ created_at      │  │ status       │  │ created_at││
│      │ updated_at      │  │ created_at   │  └───────────┘│
│      └────┬────────────┘  │ updated_at   │               │
│           │               └──────────────┘               │
│           │ One tenant has many:                         │
│           └────────────────────┬──────────────────────┐  │
│                                │                      │  │
│                    ┌───────────▼──────┐  ┌──────────▼───┐│
│                    │ rent_payments    │  │  notes       ││
│                    ├──────────────────┤  ├──────────────┤│
│                    │ id (PK)          │  │ id (PK)      ││
│                    │ user_id (FK)     │  │ user_id (FK) ││
│                    │ tenant_id (FK)   │  │ property_id  ││
│                    │ property_id (FK) │  │ (FK)         ││
│                    │ amount           │  │ tenant_id    ││
│                    │ payment_date     │  │ (FK)         ││
│                    │ payment_method   │  │ title        ││
│                    │ status           │  │ content      ││
│                    │ reference_number │  │ category     ││
│                    │ created_at       │  │ priority     ││
│                    └──────────────────┘  │ created_at   ││
│                                          │ updated_at   ││
│                                          └──────────────┘│
│                                                          │
│  ┌──────────────────┐                                   │
│  │ expenses         │                                   │
│  ├──────────────────┤                                   │
│  │ id (PK)          │                                   │
│  │ user_id (FK)     │                                   │
│  │ property_id (FK) │                                   │
│  │ category         │                                   │
│  │ amount           │                                   │
│  │ description      │                                   │
│  │ expense_date     │                                   │
│  │ receipt_url      │                                   │
│  │ created_at       │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

### Table Specifications

#### 1. properties
Main table storing all property information.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| id | UUID | PRIMARY KEY | Auto-generated |
| user_id | UUID | FOREIGN KEY, NOT NULL | Owner of property |
| name | TEXT | NOT NULL | Property name/title |
| address | TEXT | NOT NULL | Street address |
| city | TEXT | NOT NULL | City name |
| county | TEXT | NOT NULL | County/region |
| type | TEXT | NOT NULL, CHECK | apartment, house, maisonette, bedsitter, studio, commercial |
| bedrooms | INTEGER | - | Number of bedrooms |
| bathrooms | INTEGER | - | Number of bathrooms |
| rent_amount | DECIMAL(12,2) | NOT NULL | Monthly rent in KES |
| deposit_amount | DECIMAL(12,2) | - | Security deposit in KES |
| amenities | TEXT[] | DEFAULT ARRAY[] | Array of amenities (e.g., wifi, parking) |
| status | TEXT | DEFAULT 'available' | available, occupied, maintenance, vacant |
| description | TEXT | - | Property description |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

#### 2. tenants
Table storing tenant information and lease details.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| id | UUID | PRIMARY KEY | Auto-generated |
| user_id | UUID | FOREIGN KEY, NOT NULL | Property owner |
| property_id | UUID | FOREIGN KEY | Associated property |
| full_name | TEXT | NOT NULL | Tenant full name |
| email | TEXT | - | Email address |
| phone | TEXT | NOT NULL | Phone number |
| national_id | TEXT | - | National ID number |
| emergency_contact_name | TEXT | - | Emergency contact name |
| emergency_contact_phone | TEXT | - | Emergency contact phone |
| lease_start_date | DATE | - | Lease start date |
| lease_end_date | DATE | - | Lease end date |
| monthly_rent | DECIMAL(12,2) | - | Monthly rent amount |
| status | TEXT | DEFAULT 'active' | active, inactive, pending |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

#### 3. rent_payments
Tracks all rent payment transactions.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| id | UUID | PRIMARY KEY | Auto-generated |
| user_id | UUID | FOREIGN KEY, NOT NULL | Property owner |
| tenant_id | UUID | FOREIGN KEY, NOT NULL | Tenant paying rent |
| property_id | UUID | FOREIGN KEY, NOT NULL | Property for rent |
| amount | DECIMAL(12,2) | NOT NULL | Payment amount in KES |
| payment_date | DATE | NOT NULL | Date of payment |
| payment_method | TEXT | DEFAULT 'cash' | cash, bank_transfer, mpesa, airtel_money, cheque |
| status | TEXT | DEFAULT 'completed' | pending, completed, failed, cancelled |
| reference_number | TEXT | - | Payment reference/receipt number |
| notes | TEXT | - | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

#### 4. expenses
Tracks property and operational expenses.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| id | UUID | PRIMARY KEY | Auto-generated |
| user_id | UUID | FOREIGN KEY, NOT NULL | Property owner |
| property_id | UUID | FOREIGN KEY | Associated property |
| category | TEXT | NOT NULL, CHECK | maintenance, utilities, insurance, taxes, management, marketing, legal, security, cleaning, other |
| amount | DECIMAL(12,2) | NOT NULL | Expense amount in KES |
| description | TEXT | NOT NULL | Expense description |
| expense_date | DATE | NOT NULL | Date of expense |
| receipt_url | TEXT | - | URL to receipt/proof |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

#### 5. maintenance_requests
Tracks maintenance and repair requests.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| id | UUID | PRIMARY KEY | Auto-generated |
| user_id | UUID | FOREIGN KEY, NOT NULL | Property owner |
| property_id | UUID | FOREIGN KEY, NOT NULL | Property needing maintenance |
| tenant_id | UUID | FOREIGN KEY | Tenant reporting issue |
| title | TEXT | NOT NULL | Request title |
| description | TEXT | NOT NULL | Detailed description |
| category | TEXT | NOT NULL, CHECK | plumbing, electrical, hvac, appliances, structural, pest_control, security, cleaning, other |
| priority | TEXT | DEFAULT 'medium' | low, medium, high, urgent |
| status | TEXT | DEFAULT 'open' | open, in_progress, completed, cancelled |
| contractor_name | TEXT | - | Contractor/vendor name |
| contractor_phone | TEXT | - | Contractor contact |
| estimated_cost | DECIMAL(12,2) | - | Estimated repair cost |
| actual_cost | DECIMAL(12,2) | - | Actual repair cost |
| scheduled_date | DATE | - | Scheduled service date |
| completed_date | DATE | - | Actual completion date |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

#### 6. documents
Stores document metadata and URLs.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| id | UUID | PRIMARY KEY | Auto-generated |
| user_id | UUID | FOREIGN KEY, NOT NULL | Document owner |
| property_id | UUID | FOREIGN KEY | Associated property |
| tenant_id | UUID | FOREIGN KEY | Associated tenant |
| name | TEXT | NOT NULL | Document name |
| type | TEXT | NOT NULL, CHECK | lease, insurance, inspection, receipt, photo, contract, legal, other |
| file_url | TEXT | NOT NULL | URL to file |
| file_size | INTEGER | - | File size in bytes |
| mime_type | TEXT | - | File MIME type |
| created_at | TIMESTAMP | DEFAULT NOW() | Upload timestamp |

#### 7. notes
General notes system for properties and tenants.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| id | UUID | PRIMARY KEY | Auto-generated |
| user_id | UUID | FOREIGN KEY, NOT NULL | Note author |
| property_id | UUID | FOREIGN KEY | Associated property |
| tenant_id | UUID | FOREIGN KEY | Associated tenant |
| title | TEXT | NOT NULL | Note title |
| content | TEXT | NOT NULL | Note content |
| category | TEXT | DEFAULT 'general' | general, maintenance, tenant, financial, legal, reminder |
| priority | TEXT | DEFAULT 'normal' | low, normal, high |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

#### 8. user_profiles
Stores user preferences and settings.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| id | UUID | PRIMARY KEY | Auto-generated |
| user_id | UUID | FOREIGN KEY, NOT NULL, UNIQUE | Supabase auth user |
| full_name | TEXT | - | User full name |
| company_name | TEXT | - | Company/agency name |
| phone | TEXT | - | Contact phone |
| address | TEXT | - | Physical address |
| city | TEXT | - | City |
| county | TEXT | - | County |
| timezone | TEXT | DEFAULT 'Africa/Nairobi' | User timezone |
| currency | TEXT | DEFAULT 'KES' | Preferred currency |
| date_format | TEXT | DEFAULT 'DD/MM/YYYY' | Date format preference |
| theme | TEXT | DEFAULT 'light' | UI theme |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

---

## FEATURE DOCUMENTATION

### 1. Dashboard Overview
The main dashboard provides a quick overview of the property management business.

**Display Elements:**
- Total properties count
- Total tenants count
- Outstanding payments
- Monthly income overview
- Quick action buttons

### 2. Property Management
Complete property lifecycle management.

**Add Property:**
- Property name and type
- Location (address, city, county)
- Room information (bedrooms, bathrooms)
- Rent amount and deposit
- Amenities list
- Status and description

**Edit Property:**
- Update any property information
- Change status
- Update amenities
- Modify pricing

**View Property:**
- Full property details
- Associated tenants
- Payment history
- Maintenance requests
- Documents

### 3. Tenant Management
Complete tenant information and lease tracking.

**Add Tenant:**
- Full name and contact information
- National ID
- Emergency contact
- Property assignment
- Lease dates
- Rent amount
- Tenant status

**Tenant Portal:**
- View lease information
- Rental history
- Emergency contacts
- Lease renewal tracking

### 4. Financial Management
Track all property income and expenses.

**Rent Tracking:**
- Record rent payments
- Multiple payment methods (Cash, M-Pesa, Bank Transfer, etc.)
- Payment status tracking
- Generate payment receipts
- Monthly summaries

**Expense Tracking:**
- Record all property expenses
- Categorize expenses
- Attach receipts
- Track by property
- Cost analysis

**Financial Reports:**
- Monthly income vs. expenses
- Property profitability
- Tax reporting
- Cash flow analysis
- Year-to-date summaries

### 5. Maintenance Management
Track property maintenance and repairs.

**Create Request:**
- Title and detailed description
- Category (plumbing, electrical, etc.)
- Priority level
- Assign contractor
- Estimated cost
- Schedule service date

**Track Progress:**
- View all requests
- Filter by status
- Update actual costs
- Mark completed
- Add notes

### 6. Document Management
Store and organize all property documents.

**Upload Documents:**
- Property documents (leases, insurance)
- Tenant documents
- Inspection reports
- Receipts
- Photos

**Organization:**
- Filter by type
- Search documents
- Associate with property/tenant
- Download/print

### 7. Notes System
Keep important notes organized.

**Note Types:**
- General notes
- Maintenance notes
- Tenant notes
- Financial notes
- Legal notes
- Reminders

**Organization:**
- Filter by category
- Set priority
- View all notes
- Archive old notes

### 8. Reporting & Analytics
Generate comprehensive reports.

**Report Types:**
- Property performance
- Tenant list
- Payment history
- Expense analysis
- Maintenance log
- Financial summary

**Export Options:**
- CSV export
- PDF reports
- Excel format

### 9. Settings
Manage user preferences.

**Profile Settings:**
- Full name
- Company name
- Contact information
- Location

**System Preferences:**
- Currency (KES default)
- Date format
- Timezone
- Theme

**Notifications:**
- Payment alerts
- Maintenance alerts
- Lease expiry warnings
- Financial reports

**Security:**
- Password management
- Session management
- Account protection

---

## USER GUIDE

### Getting Started

#### 1. Sign Up
- Go to I-Manage website
- Click "Sign Up"
- Enter email and create password
- Verify email address
- Complete profile setup

#### 2. First Login
- Navigate to Properties page
- Click "Add Property"
- Enter property details
- Save property
- View in dashboard

#### 3. Add Tenants
- Go to Tenants page
- Click "Add Tenant"
- Link to property
- Enter tenant details
- Record lease dates and rent amount
- Save

#### 4. Track Payments
- Go to Finances page
- Click "Record Payment"
- Select tenant and property
- Enter amount and payment method
- Save payment record

### Common Workflows

#### Weekly Tasks
1. Check pending payments
2. Review maintenance requests
3. Update maintenance status
4. Log new expenses

#### Monthly Tasks
1. Generate financial report
2. Reconcile payments
3. Review maintenance requests
4. Send reminder notices

#### Quarterly Tasks
1. Generate tenant list
2. Review lease renewals
3. Property performance review
4. Update property information

---

## TECHNICAL SETUP

### Database Setup Instructions

1. **Create Supabase Project:**
   - Go to supabase.com
   - Create new project
   - Name it "I-Manage"
   - Choose region

2. **Run Database Script:**
   - Go to SQL Editor in Supabase
   - Copy entire I-MANAGE_DATABASE_SETUP.sql script
   - Paste in editor
   - Click "Run"
   - Wait for "Success" message

3. **Verify Tables Created:**
   - Go to Tables section
   - Verify 8 tables exist:
     - properties
     - tenants
     - rent_payments
     - expenses
     - maintenance_requests
     - documents
     - notes
     - user_profiles

### Application Setup

1. **Clone Repository:**
   ```bash
   git clone [repository-url]
   cd i-manage
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```

5. **Access Application:**
   - Go to http://localhost:3000
   - Sign up with test account
   - Start using I-Manage

---

## API DOCUMENTATION

### Authentication
All API requests require authentication header with JWT token.

```
Authorization: Bearer [JWT_TOKEN]
```

### Properties API

#### Get All Properties
```
GET /api/properties
Response: { success: boolean, data: Property[], error?: string }
```

#### Create Property
```
POST /api/properties
Body: { name, address, city, county, type, bedrooms, bathrooms, rent_amount, ... }
Response: { success: boolean, data: Property, error?: string }
```

#### Get Property Details
```
GET /api/properties/[id]
Response: { success: boolean, data: Property, error?: string }
```

#### Update Property
```
PUT /api/properties/[id]
Body: { ...updated fields }
Response: { success: boolean, data: Property, error?: string }
```

#### Delete Property
```
DELETE /api/properties/[id]
Response: { success: boolean, error?: string }
```

### Tenants API
Similar structure to Properties API.

### Payments API
Track rent payments and transactions.

### Maintenance API
Manage maintenance requests.

---

## SECURITY & PRIVACY

### Data Protection
- All data encrypted in transit (HTTPS/TLS)
- Database encryption at rest
- Row Level Security (RLS) enforces user data isolation
- Users can only access their own data

### Authentication
- Secure password hashing (bcrypt via Supabase)
- JWT token-based authentication
- Session management
- Automatic logout on inactivity

### Privacy
- User data never shared with third parties
- Compliant with data protection regulations
- Users can export and delete their data
- Clear privacy policy

---

## TROUBLESHOOTING

### Common Issues

#### 1. "Could not find table" Error
**Solution:** Run I-MANAGE_DATABASE_SETUP.sql in Supabase SQL Editor

#### 2. Authentication Not Working
**Solution:** Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are correct

#### 3. Data Not Saving
**Solution:** Check browser console for errors, verify Supabase RLS policies

#### 4. Slow Performance
**Solution:** Check Supabase query performance, verify indexes are created

### Support

For issues and support:
1. Check documentation
2. Review error messages in browser console
3. Verify database setup
4. Contact support team

---

## APPENDIX

### Currency Support
- Default: KES (Kenyan Shilling)
- Also supports: USD, EUR
- All amounts stored as DECIMAL(12,2)
- Formatting: Locale-specific formatting applied

### Date Formats
- Default: DD/MM/YYYY
- Alternatives: MM/DD/YYYY, YYYY-MM-DD
- All dates stored in UTC
- Timezone conversion on display

### Property Types
- Apartment
- House
- Maisonette
- Bedsitter
- Studio
- Commercial

### Payment Methods
- Cash
- Bank Transfer
- M-Pesa
- Airtel Money
- Cheque

---

**End of Documentation**

For questions or updates, please refer to the latest documentation on the I-Manage website.
