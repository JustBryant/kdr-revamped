YGOPRODeck Importer (dry-run)

This is a small dry-run script that fetches a card from the YGOPRODeck API, normalizes a few fields, and writes a sample JSON payload to `scripts/sample-<card>.json`.

Usage:

```bash
node scripts/ygoprodeck-normalize.js "Dark Magician"
```

Notes:
- The script does NOT write to the database. It only prepares the normalized payloads.
- The normalization maps `typeline` tokens into a canonical `subtypes` array. The script does NOT save the full API response (`metadata`) to avoid duplication and storage bloat.
- To preserve raw responses, consider storing them externally (S3) or enabling a flag in this script.
