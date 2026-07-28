/* ============================================================
   AURELLE — CONTENT LAYER
   Every field here is original placeholder content. When the
   backend lands, replace `AU_DATA` with a fetch() against
   /api/products, /api/collections, etc. Shape stays identical.
   ============================================================ */
window.AU_DATA = (function () {
  const SW = {
    gold:   { key: 'gold',   color: '#b8935a', label: 'Gold' },
    rose:   { key: 'rose',   color: '#c08a82', label: 'Rose Gold' },
    silver: { key: 'silver', color: '#e6e2dc', label: 'Silver' },
    emerald:{ key: 'emerald',color: '#2f5d4e', label: 'Emerald' },
    ruby:   { key: 'ruby',   color: '#8e2a3b', label: 'Ruby' },
    pearl:  { key: 'pearl',  color: '#f0e9dd', label: 'Pearl' },
  };

  /* -------------------------------------------- filter taxonomy --- */
  /* Short, searchable values. These drive the sidebar facets, the search
     suggestions and the chips on the collection page. */
  const facets = {
    style:    ['Solitaire','Tennis','Pendant','Choker','Layered','Statement','Minimal','Bridal','Floral','Heart'],
    shape:    ['Round','Oval','Pear','Emerald','Princess','Marquise','Cushion'],
    occasion: ['Daily Wear','Office Wear','Party Wear','Wedding','Festive'],
    color:    ['Silver','Gold','Rose Gold'],
    length:   ['Short','Medium','Long'],
    feature:  ['New Arrival','Best Seller','Trending','Lightweight','Adjustable Chain','Gift for Her'],
  };

  const priceBands = [
    { label: 'Under ₹999',      min: 0,    max: 999 },
    { label: '₹999 – ₹1,499',   min: 999,  max: 1499 },
    { label: '₹1,499 – ₹1,999', min: 1499, max: 1999 },
    { label: '₹2,000+',         min: 2000, max: Infinity },
  ];

  /* Typed into the search box, these surface the right products fast. */
  const searchTerms = [
    'American Diamond Necklace','AD Necklace','CZ Necklace','Diamond Pendant',
    'Tennis Necklace','Bridal Necklace','Party Necklace','Daily Wear Necklace',
    'Silver AD Necklace','Gold AD Necklace','Layered Necklace','Choker Necklace',
    'Heart Necklace','Solitaire Necklace','Floral Necklace',
  ];

  /* -------------------------------------------------- products ---- */
  const P = (slug, name, cat, price, mrp, opts) => Object.assign({
    slug, name, cat, price, mrp,
    img: `assets/img/p-${slug}.svg`,
    imgAlt: `assets/img/p-${slug}-alt.svg`,
    rating: 4.5, reviews: 40, badge: null, metal: 'Gold', occasion: ['Everyday'],
    swatches: [SW.gold],
    blurb: 'Made to be worn often and loved longer.',
  }, opts || {});

  const AD = (slug, name, style, price, mrp, opts) => Object.assign({
    slug, name, cat: 'Necklaces', subcat: style + ' Necklaces', style,
    price, mrp,
    img: `assets/img/p-${slug}.jpg`,
    imgAlt: `assets/img/p-${slug}-alt.jpg`,
    rating: 4.5, reviews: 40, badge: null,
    metal: 'Silver', color: 'Silver', shape: 'Round', length: 'Medium',
    occasion: ['Daily Wear'], features: [],
    swatches: [SW.silver],
    blurb: 'American diamond stones in a rhodium-finished setting.',
  }, opts || {});

  const products = [
    AD('ad-solitaire-radiance', 'Radiance Solitaire Necklace', 'Solitaire', 1299, 2599, {
      rating: 4.7, reviews: 168, badge: 'Bestseller', shape: 'Round', length: 'Short',
      color: 'Silver', occasion: ['Daily Wear', 'Office Wear'],
      features: ['Best Seller', 'Lightweight', 'Adjustable Chain'],
      swatches: [SW.silver, SW.gold],
      blurb: 'A single round-cut stone on a fine chain. The one you forget you are wearing.',
    }),
    AD('ad-tennis-riviera', 'Riviera Tennis Necklace', 'Tennis', 2499, 4999, {
      rating: 4.8, reviews: 94, badge: 'Bestseller', shape: 'Round', length: 'Short',
      occasion: ['Party Wear', 'Wedding'],
      features: ['Best Seller', 'Trending'],
      swatches: [SW.silver],
      blurb: 'An unbroken line of matched stones, each one set by hand.',
    }),
    AD('ad-pendant-lumina', 'Lumina Diamond Pendant', 'Pendant', 899, 1799, {
      rating: 4.6, reviews: 212, shape: 'Pear', length: 'Medium',
      occasion: ['Daily Wear', 'Office Wear'],
      features: ['Lightweight', 'Gift for Her', 'Adjustable Chain'],
      swatches: [SW.silver, SW.rose],
      blurb: 'A pear-drop stone that catches light with every turn of the head.',
    }),
    AD('ad-choker-regal', 'Regal Choker Necklace', 'Choker', 1899, 3799, {
      rating: 4.7, reviews: 76, badge: 'New', shape: 'Marquise', length: 'Short',
      color: 'Gold', metal: 'Gold', occasion: ['Party Wear', 'Festive'],
      features: ['New Arrival', 'Trending'],
      swatches: [SW.gold, SW.silver],
      blurb: 'Sits high on the collarbone. Made for a high neckline and a bare neck.',
    }),
    AD('ad-layered-cascade', 'Cascade Layered Necklace', 'Layered', 1599, 3199, {
      rating: 4.5, reviews: 58, shape: 'Round', length: 'Long',
      occasion: ['Party Wear', 'Daily Wear'],
      features: ['Trending', 'Adjustable Chain'],
      swatches: [SW.silver, SW.gold],
      blurb: 'Three tiers on one clasp — the layered look without the morning tangle.',
    }),
    AD('ad-statement-grandeur', 'Grandeur Statement Necklace', 'Statement', 3499, 6999, {
      rating: 4.9, reviews: 47, shape: 'Emerald', length: 'Short',
      occasion: ['Wedding', 'Festive'],
      features: ['Trending'],
      swatches: [SW.silver, SW.gold],
      blurb: 'Wide, bold and unapologetic. Wear it with nothing else.',
    }),
    AD('ad-floral-blossom', 'Blossom Floral Necklace', 'Floral', 1199, 2399, {
      rating: 4.6, reviews: 131, shape: 'Round', length: 'Medium',
      color: 'Rose Gold', metal: 'Rose Gold', occasion: ['Festive', 'Party Wear'],
      features: ['Gift for Her', 'Lightweight'],
      swatches: [SW.rose, SW.silver],
      blurb: 'Petals of pavé stones around an open centre.',
    }),
    AD('ad-heart-amara', 'Amara Heart Necklace', 'Heart', 799, 1599, {
      rating: 4.4, reviews: 264, shape: 'Round', length: 'Medium',
      color: 'Rose Gold', metal: 'Rose Gold', occasion: ['Daily Wear'],
      features: ['Gift for Her', 'Lightweight', 'Adjustable Chain'],
      swatches: [SW.rose, SW.silver],
      blurb: 'Our most-gifted piece, three years running.',
    }),
    AD('ad-bridal-maharani', 'Maharani Bridal Necklace', 'Bridal', 4999, 9999, {
      rating: 4.9, reviews: 63, badge: 'Bestseller', shape: 'Cushion', length: 'Long',
      color: 'Gold', metal: 'Gold', occasion: ['Wedding'],
      features: ['Best Seller'],
      swatches: [SW.gold],
      blurb: 'Full bridal weight in the look, half of it on the neck.',
    }),
    AD('ad-everyday-sheen', 'Sheen Everyday Necklace', 'Minimal', 649, 1299, {
      rating: 4.3, reviews: 301, shape: 'Round', length: 'Short',
      occasion: ['Daily Wear', 'Office Wear'],
      features: ['Lightweight', 'Adjustable Chain'],
      swatches: [SW.silver, SW.gold],
      blurb: 'Thin, flat and snag-free. Goes under a collar without a bump.',
    }),
    AD('ad-solitaire-halo', 'Halo Solitaire Necklace', 'Solitaire', 1499, 2999, {
      rating: 4.7, reviews: 88, badge: 'New', shape: 'Oval', length: 'Short',
      occasion: ['Office Wear', 'Party Wear'],
      features: ['New Arrival', 'Gift for Her'],
      swatches: [SW.silver, SW.rose],
      blurb: 'An oval centre stone ringed with pavé, so it reads larger than it is.',
    }),
    AD('ad-tennis-classic', 'Classic Tennis Necklace', 'Tennis', 1999, 3999, {
      rating: 4.6, reviews: 72, shape: 'Princess', length: 'Medium',
      occasion: ['Party Wear', 'Office Wear'],
      features: ['Trending', 'Adjustable Chain'],
      swatches: [SW.silver],
      blurb: 'Princess-cut stones in a slimmer line — the everyday tennis.',
    }),
    AD('ad-pendant-drop', 'Aria Drop Pendant', 'Pendant', 1099, 2199, {
      rating: 4.5, reviews: 145, shape: 'Marquise', length: 'Medium',
      color: 'Gold', metal: 'Gold', occasion: ['Festive', 'Daily Wear'],
      features: ['Gift for Her', 'Lightweight'],
      swatches: [SW.gold, SW.silver],
      blurb: 'A marquise stone hung so it always falls straight.',
    }),
  ];

  /* ------------------------------------------------ categories ---- */
  const categories = [
    { label: 'Solitaire Necklaces', slug: 'solitaire-necklaces', style: 'Solitaire', img: 'assets/img/cat-solitaire-necklaces.jpg', count: 24, active: true },
    { label: 'Tennis Necklaces',    slug: 'tennis-necklaces',    style: 'Tennis',    img: 'assets/img/cat-tennis-necklaces.jpg',    count: 18, active: true },
    { label: 'Pendant Necklaces',   slug: 'pendant-necklaces',   style: 'Pendant',   img: 'assets/img/cat-pendant-necklaces.jpg',   count: 42, active: true },
    { label: 'Choker Necklaces',    slug: 'choker-necklaces',    style: 'Choker',    img: 'assets/img/cat-choker-necklaces.jpg',    count: 21, active: true },
    { label: 'Layered Necklaces',   slug: 'layered-necklaces',   style: 'Layered',   img: 'assets/img/cat-layered-necklaces.jpg',   count: 16, active: true },
    { label: 'Statement Necklaces', slug: 'statement-necklaces', style: 'Statement', img: 'assets/img/cat-statement-necklaces.jpg', count: 12, active: true },
    { label: 'Floral Necklaces',    slug: 'floral-necklaces',    style: 'Floral',    img: 'assets/img/cat-floral-necklaces.jpg',    count: 19, active: true },
    { label: 'Heart Necklaces',     slug: 'heart-necklaces',     style: 'Heart',     img: 'assets/img/cat-heart-necklaces.jpg',     count: 23, active: true },
    { label: 'Bridal Necklaces',    slug: 'bridal-necklaces',    style: 'Bridal',    img: 'assets/img/cat-bridal-necklaces.jpg',    count: 15, active: true },
    { label: 'Everyday Necklaces',  slug: 'everyday-necklaces',  style: 'Minimal',   img: 'assets/img/cat-everyday-necklaces.jpg',  count: 31, active: true },
  ];

  /* --------------------------------------------------- hero ------- */
  /* `composed: true` means the artwork already carries its own headline,
     call to action and badges. Those slides render clean — no overlay text,
     no scrim — because anything drawn on top would collide with the image. */
  const hero = [
    {
      composed: true,
      img: 'assets/img/hero-wedding-edit.jpg',
      imgSmall: 'assets/img/hero-wedding-edit-sm.jpg',
      alt: 'Aurelle Wedding Edit — bridal necklace, earrings and bangle set',
      href: 'collection.html?occasion=Wedding',
      label: 'Shop the Wedding Edit',
    },
    {
      composed: true,
      img: 'assets/img/hero-sitaara.jpg',
      imgSmall: 'assets/img/hero-sitaara-sm.jpg',
      alt: 'Aurelle Sitaara Collection — crystal choker and drop earrings',
      href: 'collection.html?sort=new',
      label: 'Shop the Sitaara Collection',
    },
    {
      composed: true,
      img: 'assets/img/hero-timeless.jpg',
      imgSmall: 'assets/img/hero-timeless-sm.jpg',
      alt: 'Aurelle Timeless Elegance — emerald and gold necklace set',
      href: 'collection.html?cat=Necklace+Sets',
      label: 'Explore the collection',
    },
  ];

  /* --------------------------------------------- announcements ---- */
  const announcements = [
    'Flat <b>50% off</b> sitewide — no code needed',
    'Free shipping on orders above <b>₹999</b>',
    '<b>7-day</b> return &amp; exchange, no questions asked',
    'Anti-tarnish promise — <b>6-month</b> warranty on every piece',
  ];

  /* ------------------------------------------------ collections --- */
  const collections = [
    { label: 'The Rose Edit',    sub: '18 pieces', href: 'collection.html?metal=Rose+Gold', img: 'assets/img/b-editorial-everyday.svg' },
    { label: 'Crystal Blooms',   sub: '24 pieces', href: 'collection.html?cat=Necklace+Sets', img: 'assets/img/b-editorial-journal.svg' },
    { label: 'Bridal by Aurelle',sub: '31 pieces', href: 'collection.html?occasion=Wedding', img: 'assets/img/b-editorial-bridal.svg' },
    { label: 'Office Hours',     sub: '12 pieces', href: 'collection.html?occasion=Office', img: 'assets/img/b-story-atelier.svg' },
  ];

  const budget = [
    { label: 'Under ₹999',   sub: 'Everyday picks', href: 'collection.html?max=999',  img: 'assets/img/cat-earrings.svg' },
    { label: 'Under ₹1,499', sub: 'Gifting',        href: 'collection.html?max=1499', img: 'assets/img/cat-pendants.svg' },
    { label: 'Under ₹2,999', sub: 'Festive sets',   href: 'collection.html?max=2999', img: 'assets/img/cat-necklace-sets.svg' },
    { label: 'Under ₹4,999', sub: 'Bridal',         href: 'collection.html?max=4999', img: 'assets/img/cat-chokers.svg' },
  ];

  /* ---------------------------------------------------- reviews --- */
  const reviews = [
    { quote: 'I wore the Rosevine set for three days straight at my sister\'s wedding and it did not turn once. That has never happened to me with plated jewellery.', name: 'Ananya K.', place: 'Pune', avatar: 'assets/img/avatar-ak.svg', stars: 5, product: 'Rosevine Necklace Set' },
    { quote: 'Ordered on a Tuesday, wore it to work on Friday. The pearls look like the ones my mother has, and hers cost eight times as much.', name: 'Priya S.', place: 'Bengaluru', avatar: 'assets/img/avatar-ps.svg', stars: 5, product: 'Meera Pearl Necklace Set' },
    { quote: 'The jhumkas are the first pair I have owned that I could keep on past dinner. Weight is genuinely different.', name: 'Meher R.', place: 'Delhi', avatar: 'assets/img/avatar-mr.svg', stars: 4, product: 'Aisha Jhumka Drops' },
    { quote: 'Returned my first order for a smaller size. The exchange took four days and cost me nothing. Buying again because of that.', name: 'Sneha D.', place: 'Ahmedabad', avatar: 'assets/img/avatar-sd.svg', stars: 5, product: 'Anaya Rose Bracelet' },
    { quote: 'Bought the Ruhi pendant as a gift and ended up ordering one for myself the same week.', name: 'Nikita V.', place: 'Mumbai', avatar: 'assets/img/avatar-nv.svg', stars: 5, product: 'Ruhi Heart Pendant' },
    { quote: 'Good, not perfect — the box was a little crushed in transit. Support sent a replacement box without me asking twice.', name: 'Tanya J.', place: 'Hyderabad', avatar: 'assets/img/avatar-tj.svg', stars: 4, product: 'Sitara Choker Set' },
  ];

  /* ----------------------------------------------------- stores --- */
  const stores = [
    { city: 'Ahmedabad', name: 'Aurelle CG Road', addr: '204, Sunrise Arcade, CG Road, Navrangpura, Ahmedabad 380009', phone: '+91 79 4000 1204', hours: '11:00 – 21:00, all days' },
    { city: 'Mumbai', name: 'Aurelle Bandra', addr: 'Shop 6, Linking Road, Bandra West, Mumbai 400050', phone: '+91 22 4000 6612', hours: '11:00 – 21:30, all days' },
    { city: 'Delhi', name: 'Aurelle Hauz Khas', addr: '12A, Aurobindo Place Market, Hauz Khas, New Delhi 110016', phone: '+91 11 4000 8890', hours: '11:00 – 20:30, closed Mondays' },
    { city: 'Bengaluru', name: 'Aurelle Indiranagar', addr: '341, 100 Feet Road, Indiranagar, Bengaluru 560038', phone: '+91 80 4000 3341', hours: '11:00 – 21:00, all days' },
    { city: 'Pune', name: 'Aurelle Koregaon Park', addr: 'Ground Floor, Lane 7, Koregaon Park, Pune 411001', phone: '+91 20 4000 7712', hours: '11:00 – 21:00, all days' },
    { city: 'Hyderabad', name: 'Aurelle Jubilee Hills', addr: 'Road 36, Jubilee Hills, Hyderabad 500033', phone: '+91 40 4000 9036', hours: '11:00 – 21:00, all days' },
  ];

  /* -------------------------------------------------------- faq --- */
  const faqs = [
    { q: 'Will it tarnish?', a: 'Not under normal wear. Every piece is 24Kt gold-plated over a brass base and sealed with an anti-tarnish coat, then tested for six months of daily wear. Keep it away from perfume, chlorine and household cleaners and it will hold its finish. If a piece dulls inside six months, we replace it.' },
    { q: 'Is it safe for sensitive skin?', a: 'Yes. Every piece is nickel-free and lead-free. If you react to costume jewellery generally, start with a stud or a ring rather than a full set, and tell us — we will take the return regardless.' },
    { q: 'How long does delivery take?', a: 'Metro cities: 2–4 working days. Elsewhere in India: 4–7 working days. Orders above ₹999 ship free; below that a flat ₹79 applies. You get a tracking link by SMS and email the moment the parcel leaves our warehouse.' },
    { q: 'Can I return or exchange?', a: 'Within 7 days of delivery, for any reason, as long as the piece is unworn and in its box. Start it from Track Order or write to us. Pickup is free in serviceable pincodes; refunds land back on the original payment method within 5–7 working days.' },
    { q: 'Do you take custom or bulk orders?', a: 'For bridal parties and corporate gifting, yes — from 15 pieces upward. Write to care@aurelle.example with quantities and a date and we will come back within two working days.' },
    { q: 'Is there a warranty?', a: 'Six months from delivery, covering plating and stone-setting under normal wear. It does not cover impact damage, chemical exposure or a lost earring — but do ask anyway, we would rather fix it than lose you.' },
    { q: 'How do I find my ring size?', a: 'Wrap a strip of paper around the base of your finger, mark where it meets, measure the length in millimetres and match it to the chart on any ring page. If you are between sizes, size up — a ring that spins is easier to live with than one that pinches.' },
    { q: 'How should I store it?', a: 'Back in the pouch it arrived in, away from other pieces so nothing scratches. Put jewellery on last when you dress and take it off first when you get home. That one habit does more for plating than anything else.' },
  ];

  /* ---------------------------------------------------- journal --- */
  const journal = [
    { title: 'How to layer three chains without a single tangle', kicker: 'Styling', read: '4 min', img: 'assets/img/b-editorial-journal.svg',
      excerpt: 'Different lengths, different weights, one clasp direction. The rule that fixes it for good.' },
    { title: 'What "anti-tarnish" actually means on a spec sheet', kicker: 'Craft', read: '6 min', img: 'assets/img/b-story-atelier.svg',
      excerpt: 'Plating thickness, base metal and the sealing coat — the three numbers worth asking any brand for.' },
    { title: 'A seven-day wedding, planned piece by piece', kicker: 'Bridal', read: '8 min', img: 'assets/img/b-editorial-bridal.svg',
      excerpt: 'Haldi through vidaai, with weight and re-wearability considered for every single event.' },
  ];

  /* -------------------------------------------------- mega menu --- */
  const megamenu = {
    Shop: [
      { h: 'By category', items: categories.map(c => ({ label: c.label, href: `collection.html?cat=${encodeURIComponent(c.label)}` })) },
      { h: 'By occasion', items: ['Everyday','Office','Wedding','Festive','Gifting'].map(o => ({ label: o, href: `collection.html?occasion=${encodeURIComponent(o)}` })) },
      { h: 'By budget', items: budget.map(b => ({ label: b.label, href: b.href })) },
    ],
    Collections: [
      { h: 'Featured', items: collections.map(c => ({ label: c.label, href: c.href })) },
      { h: 'By metal', items: ['Gold','Rose Gold','Silver','Pearl'].map(m => ({ label: m, href: `collection.html?metal=${encodeURIComponent(m)}` })) },
      { h: 'Shop all', items: [{ label: 'New arrivals', href: 'collection.html?sort=new' }, { label: 'Bestsellers', href: 'collection.html?sort=popular' }, { label: 'Sale', href: 'collection.html?sale=1' }] },
    ],
  };

  const usps = [
    { icon: 'shield-check', title: '100% anti-tarnish', sub: '6-month warranty' },
    { icon: 'refresh-ccw',  title: '7-day returns',     sub: 'Free pickup' },
    { icon: 'truck',        title: 'Free shipping',     sub: 'On orders over ₹999' },
    { icon: 'sparkles',     title: 'Skin-friendly',     sub: 'Nickel & lead free' },
  ];

  return { products, categories, hero, announcements, collections, budget,
           reviews, stores, faqs, journal, megamenu, usps, SW,
           facets, priceBands, searchTerms };
})();
