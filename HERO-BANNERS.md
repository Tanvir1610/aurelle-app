# Hero banners

The homepage now runs your three banners: Wedding Edit, Sitaara Collection and
Timeless Elegance.

## What changed and why

Your artwork already carries its own headline, call to action and trust
badges. The old hero drew *its own* headline and buttons on top of a dark
scrim — two sets of words fighting in the same space.

So banners are now marked `composed: true` in `assets/js/data.js`, which
renders them clean: no scrim, no overlay text, the whole banner is the link.
The old overlay mode is still in the code, so a plain photograph would still
work if you ever mix the two.

## Weight

The originals totalled 5.4 MB, which is a slow first paint on Indian mobile
networks. Each is now served at two sizes:

| Banner | Original | Desktop | Mobile |
|---|---|---|---|
| Wedding Edit | 1966 KB | 171 KB | 51 KB |
| Sitaara | 1663 KB | 103 KB | 32 KB |
| Timeless Elegance | 1779 KB | 156 KB | 47 KB |

That is 90% smaller overall. Phones get the small file via `<picture>`, the
first banner loads at high priority and the other two lazily.

## Where each one points

| Banner | Links to |
|---|---|
| Wedding Edit | `collection.html?occasion=Wedding` |
| Sitaara Collection | `collection.html?sort=new` |
| Timeless Elegance | `collection.html?cat=Necklace+Sets` |

Change these in the `hero` array in `assets/js/data.js`.

## On phones

The baked-in text sits on the right of each image, so cropping to a short
banner would cut the headline off. Instead phones get the full picture at its
natural shape, with a real button underneath — the baked-in button is only
about 40px tall on a phone, too small to tap reliably.

## Adding or replacing a banner

1. Put the image in `assets/img/`
2. Make a mobile version at 800px wide
3. Add an entry to the `hero` array:

```js
{
  composed: true,
  img: 'assets/img/your-banner.jpg',
  imgSmall: 'assets/img/your-banner-sm.jpg',
  alt: 'Describe what is in the picture',
  href: 'collection.html?cat=Earrings',
  label: 'Shop the edit',
}
```

To compress a new one the same way:

```bash
python3 -c "
from PIL import Image
im = Image.open('input.png').convert('RGB')
im.resize((1600, round(1600*im.height/im.width))).save('assets/img/name.jpg', quality=82, optimize=True, progressive=True)
im.resize((800, round(800*im.height/im.width))).save('assets/img/name-sm.jpg', quality=78, optimize=True, progressive=True)
"
```

## One thing to check before launch

These were generated with an AI image tool. Two points worth confirming for a
commercial storefront:

- **Rights.** Check your image tool's terms cover commercial use. Most paid
  tiers do; free tiers sometimes do not.
- **The people shown.** They are synthetic, not real models, so there is no
  model release to obtain — but if a face ever resembles a real person closely,
  that becomes a personality-rights question. Worth a quick look before you
  advertise with them.
