# marketing-media

Klipy pro sociální sítě StoneForge Labs (Instagram Reels, TikTok, YouTube Shorts
přes Buffer, Bluesky). Větev generuje automaticky HQ (`scripts/make_clips.py`)
a přepisuje ji — drží jen klipy postů, které ještě nevyšly nebo vyšly nedávno,
a klipy návrhů, které čekají na schválení (`manifest.json`: kdy se který soubor
do větve dostal). Web (`main`) se jí netýká.
