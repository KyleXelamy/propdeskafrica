# I-MANAGE PROPERTY MANAGEMENT SYSTEM
## Complete Technical & User Documentation

---

## TABLE OF CONTENTS
1. System Overview
2. Installation & Setup
3. Database Setup
4. Architecture & Technical Design
5. User Features & Guide
6. API Documentation
7. Security & Compliance
8. Deployment Guide
9. Troubleshooting
10. Maintenance & Support

---

## 1. SYSTEM OVERVIEW

### What is I-Manage?
I-Manage is a professional property management platform designed for landlords and property management agencies in Kenya. It provides comprehensive tools to manage properties, tenants, finances, maintenance, and documentation all from a single, intuitive dashboard.

### Key Features
- **Property Management**: Add, edit, and track multiple properties
- **Tenant Management**: Maintain tenant records, lease information, and contact details
- **Financial Tracking**: Record rent payments, expenses, and generate financial reports in KSH
- **Maintenance Management**: Create and track maintenance requests with contractor information
- **Document Management**: Store and organize property-related documents
- **Notes System**: Keep track of important notes for properties and tenants
- **Financial Reports**: View detailed financial analytics and summaries
- **Mobile Optimized**: Fully responsive design for phone and tablet usage

### Technology Stack
- **Frontend**: Next.js 15 (React Server Components)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Currency**: Kenyan Shillings (KSH)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Deployment**: Vercel

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- No software installation required (cloud-based)

---

## 2. INSTALLATION & SETUP

### 2.1 Prerequisites
Before starting, ensure you have:
- A Vercel account (for deployment)
- A Supabase account (for database)
- Basic understanding of web applications

### 2.2 Local Setup (For Developers)

#### Step 1: Clone or Download Project
```bash
git clone <repository-url>
cd i-manage
npm install
```

#### Step 2: Setup Environment Variables
Create a `.env.local` file in the root directory with:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Step 3: Run Development Server
```bash
npm run dev
```
The application will be available at `http://localhost:3000`

### 2.3 Cloud Deployment (Recommended)

#### Step 1: Connect to Vercel
1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repository
4. Configure environment variables in Vercel dashboard

#### Step 2: Deploy
Vercel will automatically deploy when you push to main branch

---

## 3. DATABASE SETUP

### 3.1 Creating Supabase Project

1. Log into your Supabase account
2. Click "New Project"
3. Name it "i-manage"
4. Save your database credentials securely

### 3.2 Creating Database Tables

1. Go to SQL Editor in Supabase dashboard
2. Copy the entire `I-MANAGE_DATABASE_SETUP.sql` script from the project root
3. Paste into the SQL Editor
4. Click "Run" to execute
5. Verify all tables are created (you should see 8 tables)

### 3.3 Database Schema

#### Properties Table
Stores information about rental properties.
```
Columns: id, user_id, name, type, address, city, county, rent_amount, 
         amenities, description, status, created_at, updated_at
```

#### Tenants Table
Maintains tenant records linked to properties.
```
Columns: id, property_id, user_id, full_name, email, phone, id_number,
         lease_start, lease_end, rent_amount, deposit_amount, created_at
```

#### Rent Payments Table
Records all rent payment transactions.
```
Columns: id, tenant_id, property_id, user_id, amount, paid_date, 
         payment_method, status, notes, created_at
```

#### Expenses Table
Tracks property-related expenses.
```
Columns: id, property_id, user_id, category, amount, description,
         receipt_date, status, created_at
```

#### Maintenance Requests Table
Manages maintenance tasks and repairs.
```
Columns: id, property_id, user_id, description, priority, status,
         contractor_name, contractor_phone, estimated_cost, actual_cost,
         scheduled_date, completed_date, created_at
```

#### Documents Table
Stores and organizes documents.
```
Columns: id, property_id, tenant_id, user_id, file_name, file_type,
         file_size, upload_date, category, created_at
```

#### Notes Table
Keeps track of important notes.
```
Columns: id, property_id, tenant_id, user_id, title, content,
         priority, created_at, updated_at
```

#### User Profiles Table
Extends Supabase auth with additional user information.
```
Columns: id, user_id, full_name, company_name, phone, timezone,
         currency_preference, notifications_enabled, created_at
```

---

## 4. ARCHITECTURE & TECHNICAL DESIGN

### 4.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   USER INTERFACE                     │
│         (Next.js React Server Components)            │
│  ┌──────────────────────────────────────────────┐   │
│  │ Homepage | Dashboard | Properties | Tenants │   │
│  │ Finances | Maintenance | Documents | Notes  │   │
│  └──────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  NEXT.JS API   │
         │   ROUTES       │
         │  ┌──────────┐  │
         │  │Properties│  │
         │  │ Tenants  │  │
         │  │Payments  │  │
         │  │Maint.    │  │
         │  └──────────┘  │
         └───────┬────────┘
                 │
    ┌────────────▼────────────┐
    │   AUTHENTICATION        │
    │  (Supabase Auth)        │
    │  - Session Management   │
    │  - User Verification    │
    └────────────┬────────────┘
                 │
    ┌────────────▼────────────┐
    │   SUPABASE (Cloud)      │
    │  PostgreSQL Database    │
    │  ┌──────────────────┐   │
    │  │ Properties       │   │
    │  │ Tenants          │   │
    │  │ Payments         │   │
    │  │ Expenses         │   │
    │  │ Maintenance      │   │
    │  │ Documents        │   │
    │  │ Notes            │   │
    │  │ User Profiles    │   │
    │  └──────────────────┘   │
    └─────────────────────────┘
```

### 4.2 Data Flow Diagram (DFD)

```
LEVEL 0: SYSTEM CONTEXT
┌──────────────┐
│   Landlord   │
│   (User)     │
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│   I-MANAGE SYSTEM    │
│  Property Mgmt App  │
└──────┬──────────────┘
       │
       ▼
┌──────────────┐
│  Supabase    │
│  Database    │
└──────────────┘

LEVEL 1: DETAILED FLOW
┌──────────────┐
│ Landlord     │
│ Input Data   │
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│  Form Submission    │
│  (React Component)  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Validation Logic   │
│  (Form Validation)  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  API Route Handler  │
│  (/api/...)         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Authentication     │
│  Check Session      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Database Insert/    │
│ Update Operation    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Row Level Security  │
│ (RLS Policies)      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Supabase Commits   │
│  Data to Database   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Response Returned  │
│  to Frontend        │
└──────┬──────────────┘
       │
       ▼
┌──────────────┐
│  Update UI   │
│  With Data   │
└──────────────┘
```

### 4.3 Entity Relationship Diagram (ERD)

```
USER_PROFILES
  └─ Extends Supabase Auth Users

PROPERTIES (owned by user)
  ├─ Has many TENANTS
  ├─ Has many RENT_PAYMENTS  
  ├─ Has many EXPENSES
  ├─ Has many MAINTENANCE_REQUESTS
  ├─ Has many DOCUMENTS
  └─ Has many NOTES

TENANTS (linked to property)
  ├─ Has many RENT_PAYMENTS
  ├─ Has many NOTES
  └─ Has many DOCUMENTS

RENT_PAYMENTS
  └─ Belongs to TENANT & PROPERTY

EXPENSES
  └─ Belongs to PROPERTY

MAINTENANCE_REQUESTS
  └─ Belongs to PROPERTY

DOCUMENTS
  ├─ Belongs to PROPERTY (optional)
  └─ Belongs to TENANT (optional)

NOTES
  ├─ Belongs to PROPERTY (optional)
  └─ Belongs to TENANT (optional)
```

---

## 5. USER FEATURES & GUIDE

### 5.1 Authentication

#### Sign Up
1. Visit the I-Manage homepage
2. Click "Get Started"
3. Enter email and password
4. Verify email (check inbox)
5. You're ready to use I-Manage

#### Sign In
1. Visit the login page
2. Enter your email and password
3. Click "Sign In"
4. You'll be taken to your dashboard

### 5.2 Dashboard
Main hub showing:
- Total properties owned
- Total tenants managed
- Open maintenance requests
- Monthly revenue (in KSH)
- Quick action buttons

### 5.3 Property Management

#### Adding a Property
1. Go to Properties section
2. Click "Add Property"
3. Fill in details:
   - Property name
   - Property type (House, Apartment, Maisonette, Bedsitter, Studio, Land, Commercial)
   - Address, City, County
   - Monthly rent amount (in KSH)
   - Amenities (list features like WiFi, Parking, Garden)
   - Property description
   - Status (Available, Rented, Under Maintenance)
4. Click "Save"

#### Editing Properties
1. Go to Properties
2. Click on a property card
3. Click "Edit" button
4. Modify information
5. Click "Save Changes"

#### Viewing Property Details
1. Go to Properties
2. Click on property card
3. View:
   - All property information
   - Associated tenants
   - Payment history
   - Maintenance requests
   - Documents

### 5.4 Tenant Management

#### Adding a Tenant
1. Go to Tenants section
2. Click "Add Tenant"
3. Enter details:
   - Full name
   - Email
   - Phone number
   - ID number
   - Assign to property
   - Lease start date
   - Lease end date
   - Rent amount
   - Deposit amount
4. Click "Save"

#### Tracking Tenant Info
- View contact information
- Track lease expiration dates
- See payment history
- Monitor delinquent payments
- Add notes specific to tenant

### 5.5 Financial Management

#### Recording Rent Payments
1. Go to Finances section
2. Click "Add Payment"
3. Select tenant/property
4. Enter amount (in KSH)
5. Select payment method:
   - M-Pesa
   - Airtel Money
   - Bank Transfer
   - Cash
   - Cheque
6. Enter payment date
7. Mark as Paid/Pending
8. Click "Save"

#### Recording Expenses
1. Go to Finances
2. Click "Add Expense"
3. Select property
4. Choose category:
   - Repairs
   - Maintenance
   - Property Tax
   - Utilities
   - Security
   - Cleaning
   - Insurance
   - Other
5. Enter amount
6. Add description
7. Click "Save"

#### Financial Reports
1. Go to Reports section
2. View:
   - Total income (monthly/yearly)
   - Total expenses
   - Net profit
   - Property-wise breakdown
   - Payment statistics
   - Delinquent tenant list

### 5.6 Maintenance Management

#### Creating Maintenance Request
1. Go to Maintenance section
2. Click "Add Request"
3. Select property
4. Describe issue
5. Set priority (Low, Medium, High, Urgent)
6. Enter contractor details (optional)
7. Set estimated cost
8. Click "Create"

#### Tracking Maintenance
- View all requests with status
- Filter by property or status
- Track estimated vs actual costs
- Schedule completion dates
- Add notes on progress

### 5.7 Document Management

#### Uploading Documents
1. Go to Documents section
2. Click "Upload Document"
3. Select document type:
   - Lease Agreement
   - Receipt
   - Inspection Report
   - Tax Document
   - Insurance
   - Other
4. Link to property/tenant (optional)
5. Upload file
6. Click "Save"

### 5.8 Notes System

#### Adding Notes
1. Go to Notes section
2. Click "Add Note"
3. Enter title
4. Write content
5. Set priority (Low, Medium, High)
6. Link to property/tenant (optional)
7. Click "Save"

### 5.9 Settings

#### Profile Management
- Update full name
- Update company name
- Update phone number
- Change profile information

#### System Preferences
- Set timezone
- Choose currency (defaults to KSH)
- Set date format

#### Security
- Change password
- View login history
- Manage sessions

#### Notifications
- Email notifications for payments
- Lease expiration reminders
- Maintenance alerts
- Expense tracking notifications

---

## 6. API DOCUMENTATION

### 6.1 Base URL
```
https://v0-i-manage-agencies.vercel.app/api
```

### 6.2 Authentication
All API requests require authentication via Supabase session cookies. User data is automatically filtered to show only records belonging to the authenticated user.

### 6.3 Properties Endpoints

#### GET /properties
Get all properties for authenticated user
```
Response: [
  {
    id: "uuid",
    name: "Property Name",
    type: "House",
    address: "123 Main St",
    city: "Nairobi",
    county: "Nairobi",
    rent_amount: 50000,
    amenities: ["WiFi", "Parking"],
    description: "Property description",
    status: "Rented",
    created_at: "2024-02-19T10:00:00Z"
  }
]
```

#### POST /properties
Create new property
```
Body: {
  name: "New Property",
  type: "Apartment",
  address: "456 Oak Ave",
  city: "Mombasa",
  county: "Mombasa",
  rent_amount: 35000,
  amenities: ["Pool", "Gym"],
  description: "Modern apartment",
  status: "Available"
}
Response: Created property object
```

#### GET /properties/[id]
Get specific property details
```
Response: Property object with related data
```

#### PUT /properties/[id]
Update property
```
Body: Updated fields
Response: Updated property object
```

#### DELETE /properties/[id]
Delete property
```
Response: Success message
```

### 6.4 Tenants Endpoints

#### GET /tenants
Get all tenants
```
Response: Array of tenant objects
```

#### POST /tenants
Create new tenant
```
Body: {
  full_name: "John Doe",
  email: "john@example.com",
  phone: "+254712345678",
  id_number: "12345678",
  property_id: "uuid",
  lease_start: "2024-02-19",
  lease_end: "2025-02-19",
  rent_amount: 50000,
  deposit_amount: 100000
}
Response: Created tenant object
```

#### GET /tenants/[id]
Get specific tenant with history
```
Response: Tenant object with payments and notes
```

#### PUT /tenants/[id]
Update tenant information
```
Response: Updated tenant object
```

#### DELETE /tenants/[id]
Remove tenant record
```
Response: Success message
```

### 6.5 Payments Endpoints

#### GET /payments
Get all payments
```
Response: Array of payment records
```

#### POST /payments
Record new payment
```
Body: {
  tenant_id: "uuid",
  property_id: "uuid",
  amount: 50000,
  paid_date: "2024-02-19",
  payment_method: "M-Pesa",
  status: "Paid",
  notes: "Payment received"
}
Response: Created payment record
```

### 6.6 Maintenance Endpoints

#### GET /maintenance
Get all maintenance requests
```
Response: Array of maintenance requests
```

#### POST /maintenance
Create maintenance request
```
Body: {
  property_id: "uuid",
  description: "Broken window",
  priority: "High",
  contractor_name: "Contractor LLC",
  contractor_phone: "+254712345678",
  estimated_cost: 15000,
  scheduled_date: "2024-02-25"
}
Response: Created maintenance request
```

#### PUT /maintenance/[id]
Update maintenance status
```
Body: {
  status: "Completed",
  actual_cost: 12000,
  completed_date: "2024-02-25"
}
Response: Updated maintenance request
```

---

## 7. SECURITY & COMPLIANCE

### 7.1 Authentication & Authorization
- Supabase Auth handles secure authentication
- Session-based authentication with secure cookies
- Automatic session timeout after inactivity
- Password reset via email verification

### 7.2 Data Privacy
- Row Level Security (RLS) ensures users only see their own data
- All data encrypted in transit (HTTPS)
- Database backups automated daily
- No data shared with third parties

### 7.3 Password Requirements
- Minimum 8 characters
- Should contain numbers and special characters
- Change password regularly (every 90 days recommended)

### 7.4 Data Retention
- Data retained indefinitely unless user requests deletion
- Deleted data cannot be recovered
- Export data before deletion for backup

### 7.5 Compliance
- GDPR compliant (General Data Protection Regulation)
- CCPA compliant (California Consumer Privacy Act)
- Data processing agreement available
- Audit logs maintained for administrative actions

---

## 8. DEPLOYMENT GUIDE

### 8.1 Prerequisites for Deployment
1. Vercel account
2. GitHub account (recommended)
3. Supabase project setup
4. Environment variables ready

### 8.2 Step-by-Step Deployment

#### Step 1: Prepare Code
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

#### Step 2: Connect to Vercel
1. Go to vercel.com
2. Click "New Project"
3. Select your GitHub repository
4. Click "Import"

#### Step 3: Configure Environment
1. In Vercel dashboard, go to Settings > Environment Variables
2. Add all environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY

#### Step 4: Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Test the live application

#### Step 5: Custom Domain (Optional)
1. In Vercel dashboard, go to Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed

### 8.3 Post-Deployment Checklist
- [ ] Test all authentication flows
- [ ] Add a test property
- [ ] Add a test tenant
- [ ] Record a test payment
- [ ] Create a maintenance request
- [ ] Verify email notifications work
- [ ] Check mobile responsiveness
- [ ] Monitor error logs

### 8.4 Rollback Procedure
If deployment has issues:
1. Go to Vercel dashboard
2. Select "Deployments"
3. Find previous stable deployment
4. Click the three dots menu
5. Select "Rollback to this Deployment"

---

## 9. TROUBLESHOOTING

### 9.1 Common Issues & Solutions

#### Issue: "500 Internal Server Error"
**Cause**: Database connection failure or Supabase not configured
**Solution**:
1. Check environment variables in Vercel
2. Verify Supabase URL and API key
3. Ensure database tables are created (run SQL script)
4. Check Supabase dashboard for any alerts

#### Issue: "Authentication Failed"
**Cause**: Session expired or credentials incorrect
**Solution**:
1. Clear browser cookies
2. Try signing in again
3. Check email for password reset if forgotten
4. Verify Supabase Auth is enabled

#### Issue: "Cannot Add Property"
**Cause**: Database table doesn't exist or user doesn't have permission
**Solution**:
1. Run I-MANAGE_DATABASE_SETUP.sql in Supabase
2. Verify Row Level Security policies are correct
3. Check user session is active
4. Review error message in browser console

#### Issue: "Page Loads Slowly"
**Cause**: Large dataset or network issues
**Solution**:
1. Check internet connection
2. Use filters to reduce data displayed
3. Clear browser cache
4. Close unused browser tabs

#### Issue: "Emails Not Received"
**Cause**: Email configuration issue or spam filter
**Solution**:
1. Check spam/junk folder
2. Verify email address is correct
3. Request new email in account settings
4. Check Supabase email configuration

### 9.2 Browser Console Debugging

Enable browser console to see errors:
1. Press F12 (or Cmd+Option+I on Mac)
2. Go to "Console" tab
3. Look for error messages starting with "[v0]"
4. Screenshot error and contact support

### 9.3 Database Query Issues

If data isn't showing:
1. Go to Supabase dashboard
2. Open SQL Editor
3. Run: `SELECT * FROM [table_name];`
4. Verify data exists
5. Check if filters are hiding data

---

## 10. MAINTENANCE & SUPPORT

### 10.1 Regular Maintenance Tasks

#### Daily
- Monitor system performance
- Check for error logs
- Verify users can log in

#### Weekly
- Backup database (Supabase handles automatically)
- Review system statistics
- Check for security updates

#### Monthly
- Update passwords
- Review user activity
- Clean up old documents
- Archive completed maintenance requests

### 10.2 Performance Optimization

#### For Speed
1. Use property filters to reduce data
2. Archive old records regularly
3. Optimize images before uploading
4. Clear browser cache periodically

#### For Reliability
1. Keep backups of important data
2. Test backup restoration quarterly
3. Monitor database size
4. Clean up unused documents

### 10.3 Support Resources

#### Documentation
- Complete user guide included
- API documentation for developers
- Video tutorials (available online)

#### Community
- Join property management forums
- Share tips with other users
- Report bugs on GitHub

#### Professional Support
For enterprise users, professional support is available:
- Email: support@i-manage.app
- Response time: 24 hours
- Premium support: 4-hour response time

### 10.4 Feature Requests & Feedback

To suggest new features:
1. Go to GitHub Issues
2. Click "New Issue"
3. Select "Feature Request"
4. Describe your feature
5. Submit for community voting

### 10.5 Version Updates

I-Manage is continuously improved with:
- Bug fixes
- New features
- Performance improvements
- Security enhancements

Updates are deployed automatically. No action required from users.

---

## APPENDIX A: KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + K | Quick search |
| Ctrl/Cmd + N | New property |
| Ctrl/Cmd + T | New tenant |
| Ctrl/Cmd + / | Help menu |
| Esc | Close dialogs |

---

## APPENDIX B: CURRENCY & LOCALIZATION

### Supported Currency
- **Primary**: Kenyan Shillings (KSH)
- All amounts displayed as: 50,000 KSH

### Timezone
- Default: Africa/Nairobi (EAT - East Africa Time)
- Can be changed in Settings

### Date Format
- Display: 19/02/2024
- Input: DD/MM/YYYY

---

## APPENDIX C: ERROR CODES

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check form inputs |
| 401 | Unauthorized | Sign in again |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Contact support |

---

## APPENDIX D: FREQUENTLY ASKED QUESTIONS

**Q: Can I have multiple users on one account?**
A: Currently, each user account is individual. Contact support for team accounts.

**Q: How do I export my data?**
A: Go to Settings > Data Management > Export All Data

**Q: What happens if I delete a property?**
A: Associated records are preserved in history. Deletion is permanent.

**Q: Can I change my email address?**
A: Yes, in Account Settings > Change Email

**Q: Is there a mobile app?**
A: The web app is fully mobile-responsive. Native apps coming soon.

**Q: How secure is my data?**
A: All data is encrypted, backed up daily, and protected by RLS policies.

---

## APPENDIX E: TECHNICAL SPECIFICATIONS

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Screen Size Support
- Mobile: 320px+
- Tablet: 768px+
- Desktop: 1024px+

### File Upload Limits
- Maximum file size: 10MB
- Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG

### Database Limits
- Maximum properties: Unlimited
- Maximum tenants per property: Unlimited
- Maximum documents: Unlimited
- Storage: Up to 1GB per project

---

## CONCLUSION

I-Manage is designed to make property management simple and efficient. With comprehensive features for managing properties, tenants, finances, and maintenance, landlords and property managers can focus on growing their business instead of managing paperwork.

For questions or support, please contact our support team or visit our documentation portal.

**Version**: 1.0  
**Last Updated**: February 19, 2024  
**Next Review**: August 19, 2024

---
