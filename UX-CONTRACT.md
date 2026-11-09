# LUNA canonical UI contract

| Capability     | Canonical owner                       | Source of truth   | Allowed variants                   | Verification            |
| -------------- | ------------------------------------- | ----------------- | ---------------------------------- | ----------------------- |
| Select/Listbox | Native select in labeled field        | DESIGN.md         | native platform popup              | keyboard + E2E          |
| Form           | React Hook Form + Zod + labeled field | API schemas       | create/edit; noValidate            | validation tests        |
| Scrollbar      | client/src/styles/index.css           | DESIGN.md         | geometry only                      | computed styles         |
| Toast          | Sonner in app layout                  | action result     | success/error                      | live-region interaction |
| CRUD           | AdminPage + RTK Query                 | /api/v1 contracts | save refreshes list                | E2E                     |
| Dialog         | components/common/Dialog.jsx          | native dialog     | quick view/size guide/confirmation | keyboard + focus        |

Filter state is URL-owned; changing filters resets page. Server owns price, inventory and authorization. Cart is guest-persistent and merged at sign-in. Access token is memory-only; refresh cookie is httpOnly. Mutations disable duplicate submit and preserve input on failure. Errors remain inline with correction guidance; loading placeholders preserve geometry. Confirm destructive admin changes with app dialog. No fabricated payment success or reviews presented as customer evidence.
