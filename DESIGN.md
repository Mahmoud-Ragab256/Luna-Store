# LUNA design context

Audience: women shopping for considered everyday fashion in Egypt; English interface, EGP pricing, Africa/Cairo dates. Authority: create, grounded in the supplied luxury editorial brief.

Palette: ivory #FAF8F5 canvas, white #FFFFFF surfaces, charcoal #252525 text/action, blush #F4E8E6 secondary surface, beige #E9DED2 separators, rose #B98686 decoration. Rose is not used for small body text.
Type: Playfair Display for display, Inter for interface; serif fallback Georgia, sans fallback Arial. Body 14–16px, captions 12px minimum, display 40–88px with responsive clamp. Keep body measures under 70ch.
Layout: centered navigation; full-width editorial hero with left aligned copy; portrait category/product images in generous grids. Catalog has left filter rail and 3-column product area; mobile uses an accessible disclosure for filters. Account and admin share restrained white panels. Review against brief: use the explicit ivory/serif request, but avoid decorative numbering, gradients, generic KPI marketing claims and repeated floating cards.

First viewport: announcement / navigation / large editorial image with left headline / beginning of category selection. The photograph carries the expressive work; controls stay quiet and direct.

Tokens live in client/src/styles/index.css under :root; Tailwind integration supports utility use without duplicating tokens. Native selects intentionally accept platform popup behavior. Components: Layout, ProductCard, Dialog, Status, Pagination. Motion only on intentional transitions; reduced motion respected globally.

Reference research: https://www.cos.com/en-eu/women demonstrated category-first photo navigation and a quiet storefront shell; no assets copied. ARKET retrieval failed, so no visual claims made about it. Generated LUNA target kept under design/ if available. This development catalogue and its reviews are demonstration content, never real customer proof.

Verification targets: desktop 1440x1000, mobile 390x844, catalog filtering, product unavailable variant, cart, checkout validation, authenticated/admin transitions, loading/error/empty, keyboard dialogs. Evidence under artifacts/.

Language contract: English only, document lang=en and dir=ltr. No language switcher, translation dependencies or bilingual assets. Dates/numbers use en-EG with Africa/Cairo timezone; currency EGP. Updated by user instruction.

Hosted demo variant (10 November): preserve existing luxury tokens/layout. The shared announcement carries a persistent test-store notice when VITE_DEMO_MODE=true. The payment screen exposes simulation controls only after the server returns a developmentOnly session. No real customer proof or dispatch claims are introduced.

Image and navigation update, 11 November: ProgressiveImage is the canonical image-loading owner across storefront, gallery, cart/wishlist and admin previews. Image footprints remain fixed; only the image is masked during loading, with text/actions usable. Hero uses a tiny blurred WebP preview and responsive WebP sources; content images use a warm neutral shimmer and terminal fallback. Reduced motion removes shimmer/fade. Existing palette/type/layout remain authoritative. ShopLinks owns mutually exclusive Shop/New arrivals state, including sort query parameters. Favicon is a project-authored L/crescent monogram in ivory/charcoal/rose, matching the wordmark.
