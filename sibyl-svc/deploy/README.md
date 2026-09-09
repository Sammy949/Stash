# Deploying the memory sidecar to a GCP Always Free VM

The sidecar holds `memory.db`, so it needs a real disk that survives restarts.
That is the whole reason it cannot live on a stateless free tier.

## Free-tier rules that actually bite

GCP's Always Free Compute Engine allowance is narrow and it is easy to fall out
of it by accepting a default:

- **`e2-micro` only**, and **only** in `us-west1`, `us-central1` or `us-east1`.
  Any other region or size is billed.
- **30 GB of _standard_ persistent disk.** The console defaults to
  `pd-balanced`, which is **not** in the free tier. Set `pd-standard` and 30 GB.
- **1 GB/month egress** from North America. This service returns a few KB of
  JSON per call, so it is not a real constraint.
- **A billing account is required** even to use Always Free.

**Check the estimate before you click Create.** GCP is widely reported to bill
external IPv4 addresses (~$0.005/hr, ~$3.65/mo) since 2024, which — if it
applies here — would make this cost MORE than a $2.17/mo Fly machine. The VM
creation page shows a live monthly estimate in the right-hand panel. If it
reads ~$0, proceed. If it reads ~$3–4, that is the IP, and the decision is
worth revisiting.

## 1. Create the VM

```bash
gcloud compute instances create stash-sibyl \
  --project=YOUR_PROJECT \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-type=pd-standard --boot-disk-size=30GB \
  --tags=https-server,http-server
```

```bash
gcloud compute firewall-rules create allow-web \
  --allow=tcp:80,tcp:443 --target-tags=http-server,https-server
```

## 2. Point DNS at it

Get the external IP (`gcloud compute instances list`) and add an **A record**
for `sibyl.heystash.app` → that IP.

Do this **before** step 4. Caddy proves control of the hostname over port 80 to
get its certificate; if DNS has not propagated, the first start fails and you
will be reading ACME errors instead of shipping.

## 3. Install Docker on the VM

```bash
gcloud compute ssh stash-sibyl --zone=us-central1-a

sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && exec sudo su -l $USER   # pick up the group now
sudo mkdir -p /opt/stash/data                            # the DB's real home
```

## 4. Bring it up

```bash
git clone https://github.com/Sammy949/Stash && cd Stash/sibyl-svc/deploy
cp .env.example .env && nano .env      # STASH_SVC_TOKEN + Sibyl credentials
docker compose up -d --build
docker compose logs -f caddy           # watch the certificate be issued
```

## 5. Verify from your own machine, not the VM

```bash
curl https://sibyl.heystash.app/healthz          # expect 200, no auth needed
STASH_SVC_TOKEN=<same token> python3 ../probe.py https://sibyl.heystash.app
```

The probe is the real gate: 12 checks over HTTP against a live memory.db,
including consolidation and the `remembers:false` cold-start fallback. If those
pass against the public hostname, judges will see a working memory layer.

## 6. Point the app at it

In the Vercel project settings, set **`SIBYL_SVC_URL=https://sibyl.heystash.app`**
and **`SIBYL_SVC_TOKEN`** to the same token, then redeploy.

Both are server-side only (no `VITE_` prefix): `api/memory.ts` reads them in
Node, and the browser never sees the token or the hostname.

## 7. Prove the DB actually survives

The one test that matters for this host:

```bash
docker compose restart sibyl-svc
STASH_SVC_TOKEN=<token> python3 ../probe.py https://sibyl.heystash.app
```

Memory written before the restart must still be there afterwards. If it is not,
the bind mount is wrong and every promise this project makes is broken.
