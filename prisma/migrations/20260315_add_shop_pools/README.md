Name: add_shop_pools
Created: 2026-03-15

This migration adds DB-level `seenPools` and `purchasedPools` text[] columns to `KDRPlayer` and attempts to copy any existing values from the JSON `shopState`.