# Why the live site kept showing old products

Your repository had the new catalogue in it. The push worked. But the live
site kept showing Rosevine Necklace Set, Ila Floral Studs and the illustrated
tiles.

## The cause

`data/aurelle.db` is committed to the repository, and that file holds the old
28-product catalogue.

```
deploy  →  git checks out data/aurelle.db  (28 old products)
        →  server boots
        →  seeding only ran when the table was EMPTY, so it skipped
        →  /api/catalogue served the old products from that database
        →  the storefront used them instead of the new data.js
```

New code, old data, every single time. That is why nothing changed however
often you deployed.

## Fixed on both sides

**In the code.** The bundled catalogue is now fingerprinted. When it changes,
the database is brought into line on the next boot:

- products the catalogue no longer ships are **hidden**, not deleted
- products it still ships are refreshed with current names, prices and photos
- new products are added
- **anything you created or edited in the dashboard is left alone**

Stock counts survive too, so a resync never resets your inventory.

Hiding rather than deleting matters: a database created before this mechanism
existed has no record of where its products came from, so everything in it
looks seeded. Deleting on that assumption would wipe a real catalogue. Hidden
products can be switched back on from the dashboard.

**On your side, still worth doing:**

```bash
git rm --cached data/aurelle.db data/aurelle.db-shm data/aurelle.db-wal
git commit -m "Stop tracking the database"
git push
```

`.gitignore` already excludes them; that rule was added after they were first
committed, so it cannot remove them retroactively. `update-repo.sh` and
`update-repo.ps1` both do this step for you.

Without it, every deploy still overwrites live orders and customers with a
months-old snapshot. The resync now repairs the catalogue, but orders taken
between deploys would still be lost.

## Checking it worked

After deploying, the boot log reports a resync when one happens:

```
Data store   sqlite  /opt/render/project/src/data/aurelle.db
```

Or check the API directly:

```
curl https://aurelle-app.onrender.com/api/products | head -c 300
```

You want to see `ad-solitaire-radiance` and `.jpg` image paths. If you still
see `rosevine-necklace-set` and `.svg`, the deploy did not complete.
