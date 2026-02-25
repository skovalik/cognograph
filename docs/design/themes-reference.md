# Theme Presets Reference

Quick reference for implementing theme switching in the style guide.

## The 8 Themes

| # | ID | Name | Vibe |
|---|-----|------|------|
| 1 | `default` | Cogno | Cool blue, rainbow nodes |
| 2 | `crimson` | Crimson | Bold reds and roses |
| 3 | `forest` | Forest | Deep green wilderness |
| 4 | `ocean` | Ocean | Aquatic blues and teals |
| 5 | `sunset` | Sunset | Warm orange to pink |
| 6 | `violet` | Violet | Purple and magenta cosmic |
| 7 | `slate` | Slate | Neutral monochrome |
| 8 | `midnight` | Midnight | Deep indigo starlit |

## Dark Mode Colors (Primary Reference)

### Cogno (Default)
```
Canvas: linear-gradient(135deg, #0d0d14 0%, #0f0f1a 50%, #0d0d14 100%)
Grid: #1e1e2e
Panel: #0d0d14
Panel Secondary: #14161e
Text Primary: #f0f4f8
Text Secondary: #94a3b8
Accent Primary: #3b82f6
Accent Secondary: #06b6d4
Nodes: conversation=#3b82f6, project=#a855f7, note=#f59e0b, task=#10b981, artifact=#06b6d4, workspace=#ef4444, text=#94a3b8, action=#f97316
```

### Crimson
```
Canvas: linear-gradient(160deg, #0f0a0c 0%, #1a0f14 50%, #0d0608 100%)
Grid: #2d1f24
Panel: #0f0a0c
Panel Secondary: #1a1014
Text Primary: #fdf2f4
Text Secondary: #fda4af
Accent Primary: #fb7185
Accent Secondary: #e11d48
Nodes: conversation=#fb7185, project=#e11d48, note=#fbbf24, task=#f97316, artifact=#f472b6, workspace=#a855f7, text=#94a3b8, action=#fb923c
```

### Forest
```
Canvas: linear-gradient(145deg, #071108 0%, #0c1a0e 50%, #061008 100%)
Grid: #1e3324
Panel: #071108
Panel Secondary: #0e1c10
Text Primary: #ecfdf5
Text Secondary: #86efac
Accent Primary: #4ade80
Accent Secondary: #22c55e
Nodes: conversation=#4ade80, project=#22c55e, note=#bef264, task=#86efac, artifact=#2dd4bf, workspace=#f472b6, text=#94a3b8, action=#fbbf24
```

### Ocean
```
Canvas: linear-gradient(180deg, #030a1a 0%, #0c1929 50%, #041220 100%)
Grid: #1a3048
Panel: #030a1a
Panel Secondary: #0c1929
Text Primary: #e0f7ff
Text Secondary: #7dd3fc
Accent Primary: #38bdf8
Accent Secondary: #0ea5e9
Nodes: conversation=#38bdf8, project=#0ea5e9, note=#22d3ee, task=#67e8f9, artifact=#2dd4bf, workspace=#ec4899, text=#94a3b8, action=#fb923c
```

### Sunset
```
Canvas: linear-gradient(135deg, #1a0f08 0%, #1c1008 40%, #1a0d10 100%)
Grid: #3d2820
Panel: #1a0f08
Panel Secondary: #251812
Text Primary: #fef3c7
Text Secondary: #fdba74
Accent Primary: #fb923c
Accent Secondary: #f97316
Nodes: conversation=#fb923c, project=#f97316, note=#fcd34d, task=#fdba74, artifact=#f9a8d4, workspace=#c084fc, text=#94a3b8, action=#ef4444
```

### Violet
```
Canvas: linear-gradient(155deg, #0f0a18 0%, #150d20 50%, #0d081a 100%)
Grid: #2e2245
Panel: #0f0a18
Panel Secondary: #181024
Text Primary: #f5f0ff
Text Secondary: #d8b4fe
Accent Primary: #c084fc
Accent Secondary: #a855f7
Nodes: conversation=#c084fc, project=#a855f7, note=#f0abfc, task=#d8b4fe, artifact=#f472b6, workspace=#22d3ee, text=#94a3b8, action=#fb923c
```

### Slate
```
Canvas: #0c1017
Grid: #1e2836
Panel: #0c1017
Panel Secondary: #141c26
Text Primary: #e2e8f0
Text Secondary: #94a3b8
Accent Primary: #94a3b8
Accent Secondary: #64748b
Nodes: conversation=#94a3b8, project=#64748b, note=#a1a1aa, task=#a8a29e, artifact=#9ca3af, workspace=#d4d4d8, text=#94a3b8, action=#78716c
```

### Midnight
```
Canvas: linear-gradient(180deg, #07081a 0%, #0d0f28 50%, #050614 100%)
Grid: #252855
Panel: #07081a
Panel Secondary: #0d1025
Text Primary: #e0e7ff
Text Secondary: #a5b4fc
Accent Primary: #a5b4fc
Accent Secondary: #818cf8
Nodes: conversation=#a5b4fc, project=#818cf8, note=#c4b5fd, task=#93c5fd, artifact=#e0e7ff, workspace=#f9a8d4, text=#94a3b8, action=#fdba74
```

## Source File

All theme data comes from:
`src/renderer/src/constants/themePresets.ts`

When implementing, this file can be referenced directly for the complete data structure including light mode variants.
