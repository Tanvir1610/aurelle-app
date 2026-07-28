# Product images

## Where things stand

All 13 products carry your real photography from `product_images.zip`. There
is no generated placeholder art left in the catalogue. If your live site still
shows the illustrated tiles, that deploy predates this build.

Each product has two files:

```
assets/img/p-<slug>.jpg        square crop for the grid
assets/img/p-<slug>-alt.jpg    tighter crop, shown on hover
```

## Adding images for new products

I cannot download images from the web — this environment blocks every image
host — so images come from one of two places.

**Your own files.** Drop them in `assets/img/` and reference them as
`assets/img/name.jpg`.

**A URL.** In the dashboard, Products → Add or Edit gives you three fields:

| Field | What it does |
|---|---|
| Thumbnail image URL | The grid and bag image |
| Hover image URL | Second angle; blank reuses the thumbnail |
| Product images | One URL per line, fills the product page gallery |

Absolute URLs (`https://…`) and site-relative paths (`assets/img/…`) both
work. The preview strip and the storefront card update as you type.

## A caution about hotlinking

Pointing at images on someone else's site is tempting and usually a mistake:

- Many hosts block requests from other domains, so the image loads for you and
  breaks for customers
- The owner can move or delete it without warning
- Using product photography you do not own is a copyright problem, and a
  visible one on a shop that takes money

Host your own files, or use a CDN you control — Cloudinary, imgix, Supabase
Storage and Cloudflare R2 all have free tiers that suit a small catalogue.

## Preparing photos

Square crops at 900px keep the grid aligned and the files small:

```bash
python3 -c "
from PIL import Image
im = Image.open('photo.jpg').convert('RGB')
w, h = im.size; side = min(w, h)
top = max(0, int((h - side) * 0.35))   # necklaces sit high in a portrait shot
left = (w - side) // 2
im.crop((left, top, left+side, top+side)).resize((900, 900)) \
  .save('assets/img/p-my-piece.jpg', quality=84, optimize=True, progressive=True)
"
```

That is the same process used on your 13 photos: roughly 120KB each, from
originals averaging 1.5MB.
