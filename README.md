# Project Greece Social Publisher

Deterministic social publishing for Project Greece. No OpenAI/ChatGPT API is used at runtime.

## Flow

Base44 episode data → Sharp/SVG rendering → Cloudflare R2 → Buffer GraphQL API → Facebook / Instagram / TikTok.

## Schedule

- Monday 10:00 Europe/Athens: weekly overview while Series 1 is active.
- Wednesday 10:00: Saturday episode teaser.
- Friday 10:00: Sunday episode teaser.
- From 28 Dec 2026: one evergreen episode every Monday for 20 weeks.

The workflow runs daily and looks ahead 10 days, so Buffer already has posts queued before publication day.

## Required GitHub secrets

- `BUFFER_API_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

## Required GitHub variables

- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

Expected values for the current setup:

- `R2_BUCKET=projectgreece-social`
- `R2_PUBLIC_BASE_URL=https://social.projectgreece.gr`
- `R2_ENDPOINT=https://71df1aae81066a5a05bbbc698c112f31.r2.cloudflarestorage.com`

## Safety

Publishing is idempotent against existing Buffer scheduled posts. Media is uploaded to stable R2 URLs and remains reachable until publish time.
