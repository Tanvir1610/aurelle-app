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

  /* -------------------------------------------------- products ---- */
  const P = (slug, name, cat, price, mrp, opts) => Object.assign({
    slug, name, cat, price, mrp,
    img: `assets/img/p-${slug}.svg`,
    imgAlt: `assets/img/p-${slug}-alt.svg`,
    rating: 4.5, reviews: 40, badge: null, metal: 'Gold', occasion: ['Everyday'],
    swatches: [SW.gold],
    blurb: 'Made to be worn often and loved longer.',
  }, opts || {});

  const products = [
    P('rosevine-necklace-set', 'Rosevine Necklace Set', 'Necklace Sets', 2400, 4799, {
      rating: 4.6, reviews: 212, badge: 'Bestseller', metal: 'Rose Gold',
      occasion: ['Wedding', 'Festive'], swatches: [SW.gold, SW.rose],
      blurb: 'A climbing-vine collar with a hand-set centre stone — the piece people ask about before they ask your name.',
    }),
    P('amara-emerald-studs', 'Amara Emerald Studs', 'Earrings', 1250, 2499, {
      rating: 4.8, reviews: 64, badge: 'New', metal: 'Gold',
      occasion: ['Office', 'Everyday'], swatches: [SW.emerald, SW.ruby],
      blurb: 'Six petals around a deep green centre. Light enough for a twelve-hour day.',
    }),
    P('solene-pearl-drops', 'Solene Pearl Drops', 'Earrings', 900, 1799, {
      rating: 4.4, reviews: 38, metal: 'Silver', occasion: ['Office', 'Everyday'],
      swatches: [SW.silver, SW.gold],
      blurb: 'A single freshwater-look pearl on a fine hook. Quiet, and quietly expensive-looking.',
    }),
    P('mahira-ruby-hasli', 'Mahira Ruby Hasli Set', 'Necklace Sets', 3500, 6999, {
      rating: 4.7, reviews: 156, badge: 'Bestseller', metal: 'Gold',
      occasion: ['Wedding', 'Festive'], swatches: [SW.ruby, SW.gold],
      blurb: 'A rigid hasli collar with ruby-red stones — built for the sangeet, kept for the anniversary.',
    }),
    P('noor-solitaire-pendant', 'Noor Solitaire Pendant', 'Pendants', 1500, 2999, {
      rating: 4.5, reviews: 98, occasion: ['Everyday', 'Gifting'], swatches: [SW.gold, SW.silver],
      blurb: 'One stone, one chain, nothing else. The pendant you stop taking off.',
    }),
    P('sitara-choker-set', 'Sitara Choker Set', 'Chokers', 2750, 5499, {
      rating: 4.9, reviews: 41, badge: 'New', metal: 'Gold',
      occasion: ['Festive', 'Wedding'], swatches: [SW.gold, SW.rose],
      blurb: 'Nineteen graduated stones that sit high on the collarbone. Made for a high neckline.',
    }),
    P('ila-floral-studs', 'Ila Floral Studs', 'Earrings', 499, 899, {
      rating: 4.3, reviews: 210, metal: 'Rose Gold', occasion: ['Everyday'],
      swatches: [SW.rose, SW.emerald],
      blurb: 'The first pair most people buy from us, and the pair they re-buy in a second finish.',
    }),
    P('veda-kundan-tikka', 'Veda Kundan Maang Tikka', 'Maang Tikka', 1350, 2699, {
      rating: 4.6, reviews: 52, occasion: ['Wedding'], swatches: [SW.gold],
      blurb: 'A kundan-style centrepiece on a beaded chain, weighted so it sits flat and stays put.',
    }),
    P('anaya-rose-bracelet', 'Anaya Rose Bracelet', 'Bracelets', 1250, 2499, {
      rating: 4.4, reviews: 73, metal: 'Rose Gold', occasion: ['Everyday', 'Gifting'],
      swatches: [SW.rose, SW.gold],
      blurb: 'Twelve stones on an adjustable link. Sized to fit almost every wrist we have measured.',
    }),
    P('kiara-crystal-bloom-set', 'Kiara Crystal Bloom Set', 'Necklace Sets', 2150, 4299, {
      rating: 4.8, reviews: 187, badge: 'Bestseller', metal: 'Gold',
      occasion: ['Festive', 'Office'], swatches: [SW.emerald, SW.rose],
      blurb: 'Necklace and matching studs. Bought as a set far more often than separately.',
    }),
    P('zara-sapphire-ring', 'Zara Sapphire Ring', 'Rings', 800, 1599, {
      rating: 4.2, reviews: 44, metal: 'Silver', occasion: ['Everyday', 'Office'],
      swatches: [SW.silver, SW.ruby],
      blurb: 'A raised blue stone on a slim band. Stacks well with the Riya.',
    }),
    P('meera-pearl-necklace-set', 'Meera Pearl Necklace Set', 'Necklace Sets', 1350, 2699, {
      rating: 4.5, reviews: 129, metal: 'Pearl', occasion: ['Office', 'Everyday'],
      swatches: [SW.pearl, SW.gold],
      blurb: 'Graduated pearls with a gold clasp. Reads formal without reading costume.',
    }),
    P('tara-halo-hoops', 'Tara Halo Hoops', 'Earrings', 1100, 2199, {
      rating: 4.7, reviews: 88, badge: 'New', occasion: ['Everyday', 'Office'],
      swatches: [SW.gold, SW.silver],
      blurb: 'Hoops with a ring of small stones on the front face only — the back stays smooth against the neck.',
    }),
    P('nisha-stackable-bangles', 'Nisha Stackable Bangles', 'Bangles', 1950, 3899, {
      rating: 4.6, reviews: 102, occasion: ['Festive', 'Wedding'], swatches: [SW.gold, SW.rose],
      blurb: 'A set of three in graduating widths. Wear all three, or just the thin one.',
    }),
    P('aleena-teardrop-danglers', 'Aleena Teardrop Danglers', 'Earrings', 1450, 2899, {
      rating: 4.5, reviews: 57, metal: 'Ruby', occasion: ['Wedding', 'Festive'],
      swatches: [SW.ruby, SW.gold],
      blurb: 'Long enough to catch light when you turn your head, light enough to forget.',
    }),
    P('riya-minimal-band', 'Riya Minimal Band', 'Rings', 599, 1199, {
      rating: 4.4, reviews: 165, metal: 'Silver', occasion: ['Everyday', 'Office'],
      swatches: [SW.silver, SW.gold],
      blurb: 'Two millimetres wide. The one you wear to the gym and forget to take off.',
    }),
    P('saira-layered-chain', 'Saira Layered Chain', 'Pendants', 1650, 3299, {
      rating: 4.6, reviews: 71, badge: 'Bestseller', occasion: ['Everyday'],
      swatches: [SW.gold, SW.silver],
      blurb: 'Two chains, one clasp — the layered look without the tangle.',
    }),
    P('devi-temple-choker', 'Devi Temple Choker', 'Chokers', 3200, 6399, {
      rating: 4.8, reviews: 63, occasion: ['Wedding', 'Festive'], swatches: [SW.gold],
      blurb: 'Temple-motif panels on a fitted band. Our most requested bridal piece.',
    }),
    P('mira-pearl-bangle', 'Mira Pearl Bangle', 'Bangles', 1050, 2099, {
      rating: 4.3, reviews: 49, metal: 'Pearl', occasion: ['Office', 'Everyday'],
      swatches: [SW.pearl, SW.silver],
      blurb: 'Pearls set flush into the band so nothing catches on a sleeve.',
    }),
    P('elara-emerald-ring', 'Elara Emerald Ring', 'Rings', 1350, 2699, {
      rating: 4.7, reviews: 61, metal: 'Emerald', occasion: ['Festive', 'Gifting'],
      swatches: [SW.emerald, SW.gold],
      blurb: 'A cushion-cut green stone with a fine gold halo. Sits low, snags nothing.',
    }),
    P('aisha-jhumka-drops', 'Aisha Jhumka Drops', 'Earrings', 1750, 3499, {
      rating: 4.9, reviews: 143, badge: 'Bestseller', occasion: ['Wedding', 'Festive'],
      swatches: [SW.ruby, SW.gold],
      blurb: 'A classic jhumka silhouette at half the usual weight. Your ears will notice the difference by hour four.',
    }),
    P('naina-charm-bracelet', 'Naina Charm Bracelet', 'Bracelets', 1500, 2999, {
      rating: 4.5, reviews: 84, occasion: ['Gifting', 'Everyday'], swatches: [SW.gold, SW.rose],
      blurb: 'Five charms on an adjustable chain. Add to it over the years.',
    }),
    P('ruhi-heart-pendant', 'Ruhi Heart Pendant', 'Pendants', 750, 1499, {
      rating: 4.4, reviews: 198, metal: 'Rose Gold', occasion: ['Gifting', 'Everyday'],
      swatches: [SW.rose, SW.silver],
      blurb: 'Small, rose-gold, and our most-gifted piece three years running.',
    }),
    P('ishani-bridal-set', 'Ishani Bridal Necklace Set', 'Necklace Sets', 4800, 9599, {
      rating: 4.9, reviews: 76, badge: 'Bestseller', metal: 'Ruby',
      occasion: ['Wedding'], swatches: [SW.ruby, SW.gold],
      blurb: 'Necklace, earrings and tikka. Everything the look needs, in one box.',
    }),
    P('lira-pearl-studs', 'Lira Pearl Studs', 'Earrings', 450, 899, {
      rating: 4.2, reviews: 231, metal: 'Pearl', occasion: ['Office', 'Everyday'],
      swatches: [SW.pearl, SW.gold],
      blurb: 'The stud you keep a spare pair of.',
    }),
    P('avni-chandbali', 'Avni Chandbali Earrings', 'Earrings', 2100, 4199, {
      rating: 4.8, reviews: 92, occasion: ['Wedding', 'Festive'], swatches: [SW.gold, SW.ruby],
      blurb: 'A crescent frame with a beaded fringe. Full drama, half the weight.',
    }),
    P('kaya-twist-ring', 'Kaya Twist Ring', 'Rings', 899, 1799, {
      rating: 4.3, reviews: 55, metal: 'Rose Gold', occasion: ['Everyday'],
      swatches: [SW.rose, SW.silver],
      blurb: 'Two strands twisted into one band. Looks like a stack, wears like a single ring.',
    }),
    P('tanvi-polki-tikka', 'Tanvi Polki Maang Tikka', 'Maang Tikka', 1899, 3799, {
      rating: 4.7, reviews: 38, badge: 'New', metal: 'Ruby',
      occasion: ['Wedding'], swatches: [SW.ruby, SW.gold],
      blurb: 'Polki-style uncut stones with a hook that grips without pulling.',
    }),
  ];

  /* ------------------------------------------------ categories ---- */
  const categories = [
    { label: 'Necklace Sets', slug: 'necklace-sets', img: 'assets/img/cat-necklace-sets.svg', count: 128 },
    { label: 'Earrings',      slug: 'earrings',      img: 'assets/img/cat-earrings.svg',      count: 342 },
    { label: 'Rings',         slug: 'rings',         img: 'assets/img/cat-rings.svg',         count: 96 },
    { label: 'Bracelets',     slug: 'bracelets',     img: 'assets/img/cat-bracelets.svg',     count: 74 },
    { label: 'Chokers',       slug: 'chokers',       img: 'assets/img/cat-chokers.svg',       count: 38 },
    { label: 'Pendants',      slug: 'pendants',      img: 'assets/img/cat-pendants.svg',      count: 61 },
    { label: 'Maang Tikka',   slug: 'maang-tikka',   img: 'assets/img/cat-maang-tikka.svg',   count: 27 },
    { label: 'Bangles',       slug: 'bangles',       img: 'assets/img/cat-bangles.svg',       count: 52 },
  ];

  /* --------------------------------------------------- hero ------- */
  const hero = [
    {
      eyebrow: 'New season',
      title: 'Adorn your every day.',
      body: 'Anti-tarnish, skin-friendly, 24Kt gold-plated. Made for the days you are not dressing up for anyone.',
      cta: { label: 'Shop new arrivals', href: 'collection.html?sort=new' },
      cta2: { label: 'View lookbook', href: 'journal.html' },
      img: 'assets/img/b-hero-01.svg',
      video: null,
    },
    {
      eyebrow: 'The grand Aurelle sale',
      title: 'Flat 50% off, sitewide.',
      body: 'Every set, every stud, every stacking ring. No code needed — the price you see is the price you pay.',
      cta: { label: 'Shop the sale', href: 'collection.html?sale=1' },
      cta2: { label: 'Under ₹999', href: 'collection.html?max=999' },
      img: 'assets/img/b-hero-02.svg',
      video: null,
    },
    {
      eyebrow: 'Wedding season',
      title: 'For the week of the wedding.',
      body: 'Hasli collars, chandbalis and tikkas built light enough to wear from the haldi through to the vidaai.',
      cta: { label: 'Shop bridal', href: 'collection.html?occasion=Wedding' },
      cta2: { label: 'Find a store', href: 'stores.html' },
      img: 'assets/img/b-hero-03.svg',
      video: null,
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
           reviews, stores, faqs, journal, megamenu, usps, SW };
})();
