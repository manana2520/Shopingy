# Shopingy Mall Analyzer - Architecture Document

## Overview

Shopingy is a B2B SaaS platform ("SHOPINGY MALL ANALYZER") that provides data intelligence for the retail real estate industry. It tracks tenant structures in shopping malls across Europe and North America, offering insights to real estate investors, retailers, and consultants.

**Company:** Shopingy s.r.o., Prague, Czech Republic (ID: 089 87 220)

## Platform Components

### 1. Public Marketing Website
- **URL:** https://www.shopingy.com/
- **Tech Stack:** Static HTML, jQuery, Slick.js (carousel), Google Tag Manager
- **Pages:** Home, Pricing, Contacts
- **Purpose:** Marketing, lead generation, Calendly meeting scheduling

### 2. Business Application (Core Product)
- **URL:** https://business.shopingy.com/
- **Tech Stack:**
  - **Backend:** PHP/Symfony (based on error page patterns and CSRF tokens) or Laravel
  - **Frontend:** Webpack-bundled JS (build/ directory with hashed assets), jQuery DataTables
  - **CSS:** Custom compiled CSS (app.2437d502.css), DataTables buttons CSS
  - **Icons:** Material Design Icons (MDI)
  - **Analytics:** Google Analytics (UA-129901798-2), ProductFruits (onboarding/analytics)
  - **Maps:** Likely Leaflet or Google Maps (Heatmap feature, lat/lng data)
- **Auth:** Cookie-based session authentication (login at /login, register at /register)
- **API Pattern:** Server-side DataTables - POST requests with draw/start/length pagination

---

## Data Model

### Core Entities

#### Shopping Malls (325 records in Czech Republic subscription)
| Field | Description |
|---|---|
| ID | Internal numeric ID |
| Name | Mall name (e.g., "Arkady Pankrac") |
| Brands | Count of brands in the mall |
| Stores | Count of stores in the mall |
| GLA (m2) | Gross Leasable Area in square meters |
| Type | Mall type (Shopping Mall, Outlet Center - Europe, Outlet Center - US, Airport, Retail Park, + 2 more) |
| City | City name |
| ZIP | Postal code |
| Country | Country name |
| WWW | Mall website URL |
| Mall Plan | URL to mall floor plan |
| Mall Operator | Operating company (165 unique operators) |
| Last Update | Date of last data update |
| In Database From | Date mall was added to database |
| Latitude | GPS latitude |
| Longitude | GPS longitude |

#### Stores (10,932 records in Czech Republic)
| Field | Description |
|---|---|
| Store Status | Active / Closed |
| Store Name | Name of the store |
| Store Type | Monobrand / Multibrand |
| Store Brands | Brands sold in the store |
| Major Category | Primary product category |
| Additional Categories | Secondary categories |
| Store Tags | Additional classifications |
| Shopping Mall | Which mall the store is in |
| Type of Shopping Mall | Mall classification |
| City | City |
| ZIP | Postal code |
| Country | Country |
| Store sqm | Store size in square meters |
| Store Size | Size category (XXL: 1500+, XL: 600-1499, L: 200-599, M: 61-199, S: 16-60, XS: <15) |
| Street / Mall | Whether the store is on a street or in a mall |
| WWW | Store website |
| Closed Stores | Date closed (if applicable) |
| Newly Opened Stores | Date opened (if new) |
| Created On | Record creation date |
| Updated On | Record last update date |

#### Store Index (Unique Stores) (4,419 unique stores)
| Field | Description |
|---|---|
| Status | Active / Closed |
| Store Name | Unique store/brand name |
| Sum (Sigma) | Total number of locations |
| Store Type | Monobrand / Multibrand |
| Major Category | Primary category |
| Additional Categories | Secondary categories |
| Store Tags | Tags |
| City | City |
| ZIP | Postal code |
| Country | Country |

#### Brands (1,340 brands)
| Field | Description |
|---|---|
| Brand Name | Name of the brand |
| Category | Product categories (can be multiple) |
| Website | Brand website |
| Brand Tags | Additional tags |
| MonobrandStores[Country] | Count of monobrand stores per country (columns per country) |
| MultibrandStores[Country] | Count of multibrand stores per country (columns per country) |

Countries tracked in Brands table: Austria, Belgium, Bulgaria, Canada, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Mexico, Montenegro, Netherlands, Norway, Poland, Portugal, Romania, Russia, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, UAE, Ukraine, United Kingdom, USA (36 countries)

### Enum/Reference Data
| Enum | Count | Description |
|---|---|---|
| active | 2 | Active, Closed |
| types | 3 | (empty), Monobrand, Multibrand |
| categories | 20 | Apparel, Bags & Accessories, Department Store, Entertainment, etc. |
| kinds | 71 | Antiques, Bakery, Bank, Bikes, etc. (subcategories) |
| cities | 129 | Cities in the subscription region |
| countries | varies | Depends on subscription |
| sizes | 6 | XXL, XL, L, M, S, XS |
| outlettype | 7 | Shopping Mall, Outlet Center - Europe, Outlet Center - US, Airport, Retail Park, etc. |
| streetmall | 2 | Street, Mall |
| brands | 1,340 | All monitored brand names |
| malls | 325 | All mall names in subscription |
| mallsoperator | 165 | Mall operator companies |

---

## API Endpoints

### Data APIs (POST - DataTables server-side)
| Endpoint | Description |
|---|---|
| POST /api/shops/ | List of all stores (paginated, filterable) |
| POST /api/unique-shops/ | Store index / unique stores |
| POST /api/shoppingmalls/ | List of all malls |
| POST /api/brands/ | List of all brands with country pivot |

### Enum APIs (GET)
| Endpoint | Description |
|---|---|
| GET /api/enums/active | Store status values |
| GET /api/enums/types | Store type values |
| GET /api/enums/categories | Major categories |
| GET /api/enums/kinds | Subcategories/tags |
| GET /api/enums/cities | Available cities |
| GET /api/enums/countries | Available countries |
| GET /api/enums/brands | Brand names |
| GET /api/enums/malls | Mall names |
| GET /api/enums/outlettype | Mall types |
| GET /api/enums/sizes | Store size categories |
| GET /api/enums/streetmall | Street/Mall classification |
| GET /api/enums/mallsoperator | Mall operators |

### Helper APIs (GET)
| Endpoint | Description |
|---|---|
| GET /api/helpers/tables/selections/ | Saved selections for stores |
| GET /api/helpers/tables/selections/?type=unique | Saved selections for unique stores |
| GET /api/helpers/tables/selections/malls | Saved selections for malls |
| GET /api/helpers/tables/selections/brands | Saved selections for brands |

---

## Features

### Core Features
1. **Data Browsing** - Filterable, sortable DataTables for all entities
2. **XLS Export** - Download data as Excel files (per page or full export)
3. **Favorite Filters** - Save filter presets (e.g., "Monobrands + City Prague")

### Advanced Features
4. **Click & Compare (GAP Analysis)** - Compare up to 10 selections of malls/stores/streets side by side; results sortable by matches or alphabetically
5. **Heatmap** - Display up to 10 selections on a geographic map with different colors
6. **Stores History** - Track newly opened and closed stores with date range filtering

### User Features
7. **User Authentication** - Login/registration with email/password
8. **User Management** - Admin panel at /user/ (restricted access)

---

## Business Model

- **Subscription:** Annual per-country access, priced EUR 1,990 - 4,990 per year per access
- **Pricing by region:**
  - DACH: Germany EUR 4,990, Austria EUR 2,990, Switzerland EUR 3,290
  - Nordic: EUR 2,490 - 3,290
  - CEE: EUR 1,990 - 4,590
  - Western Europe: EUR 2,490 - 4,490
  - Outlets: EUR 3,290
- **Data scope:** 7,771+ shopping malls, 340,682+ stores, 1,340+ brands, 3,950+ cities across 28+ countries

---

## Global Scale

| Region | Countries | Total Malls |
|---|---|---|
| DACH | Germany, Austria, Switzerland | 1,476 |
| Nordic | Sweden, Finland, Norway, Denmark, Estonia+Lithuania+Latvia | 783 |
| CEE | Czech Republic, Slovakia, Poland, Hungary, Slovenia, Romania, Croatia, Serbia, Bulgaria, Montenegro+BiH+NMK+Kosovo+Albania | 2,164 |
| Western Europe | Italy, Spain, Portugal, France, Netherlands, Belgium+Luxembourg, UK, Ireland | 3,175 |
| Outlets | USA+Canada, European | 433 |
| **Total** | | **~8,031** |
