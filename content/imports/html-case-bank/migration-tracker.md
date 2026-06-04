# Legacy Station Migration Tracker

This file tracks conversion of extracted legacy stations into the new guided case system.

Generated from:

`content/imports/html-case-bank/extracted/station-index.json`

## Status labels


- `selected` — chosen for conversion
- `converted` — converted into a guided case MDX file
- `needs-edit` — converted but requires clinical/content review
- `skipped` — not suitable for migration
- `duplicate` — overlaps with an existing guided case

## Converted cases

| Legacy ID | Legacy title | New guided case | Status | Notes |
|---|---|---|---|---|
| manual | RCRSP case | content/cases/shoulder/rcrsp-case-01.mdx | converted | Created manually before legacy extraction |
| manual | Adhesive capsulitis case | content/cases/shoulder/adhesive-capsulitis-case-01.mdx | converted | Created manually before legacy extraction |
| manual | Cervical radiculopathy case | content/cases/cervical/cervical-radiculopathy-case-01.mdx | converted | Created manually before legacy extraction |
| s28 | Distal Biceps Rupture — Referral Decision | content/cases/elbow/distal-biceps-rupture-case-01.mdx | converted | Acute referral reasoning case |
| s20 | Degenerative Cervical Myelopathy — Early Presentation | content/cases/cervical/early-degenerative-cervical-myelopathy-case-01.mdx | converted | Early DCM / wrong-pathway prevention case |
| s44 | Visceral Referral Mimicking Thoracic MSK | content/cases/thoracic/visceral-referral-mimicking-thoracic-msk-case-01.mdx | converted | Visceral referral / non-MSK thoracic pain case |

## Pending review

| Legacy ID | Legacy title | Suggested region | Priority | Status | Notes |
|---|---|---|---|---|---|
| s1 | Cervical Radiculopathy | cervical | medium | pending-review |  |
| s2 | Degenerative Cervical Myelopathy | cervical | high | pending-review |  |
| s3 | Whiplash Associated Disorder | unknown | normal | pending-review |  |
| s4 | Cervicogenic Headache | cervical | normal | pending-review |  |
| s5 | Rotator Cuff Related Shoulder Pain | shoulder | medium | pending-review |  |
| s6 | Adhesive Capsulitis | unknown | normal | pending-review |  |
| s7 | Shoulder Instability | shoulder | medium | pending-review |  |
| s8 | Neuralgic Amyotrophy (Parsonage-Turner) | unknown | normal | pending-review |  |
| s9 | Thoracic Pain: Visceral vs MSK | thoracic | normal | pending-review |  |
| s10 | Thoracic Osteoporotic Fracture | thoracic | high | pending-review |  |
| s11 | Thumb Base Osteoarthritis | wrist-hand | normal | pending-review |  |
| s12 | Acute Thumb UCL Injury | wrist-hand | normal | pending-review |  |
| s13 | Hand Osteoarthritis | wrist-hand | normal | pending-review |  |
| s14 | General Red Flag Framework | unknown | high | pending-review |  |
| s15 | Headache / Cervical Safety Screen | cervical | normal | pending-review |  |
| s16 | Modern Manual Therapy Justification | unknown | normal | pending-review |  |
| s17 | Lateral Epicondylitis — Injection Dilemma | elbow | normal | pending-review |  |
| s18 | Cubital Tunnel Syndrome | unknown | normal | pending-review |  |
| s19 | Thoracic Outlet Syndrome — nTOS | thoracic | medium | pending-review |  |
| s21 | Parsonage-Turner Syndrome — Extended Case | unknown | normal | pending-review |  |
| s22 | Osteoporotic Vertebral Fracture — Management | unknown | high | pending-review |  |
| s23 | Cervical Radiculopathy — Official OSCE Format | cervical | medium | pending-review |  |
| s24 | DCM — Escalation &amp; Communication | unknown | normal | pending-review |  |
| s25 | Neurogenic TOS + Vascular Safety Net | unknown | normal | pending-review |  |
| s26 | WAD — Biopsychosocial Management | unknown | normal | pending-review |  |
| s27 | CGH — Return to Running | unknown | normal | pending-review |  |
| s29 | CTS High Irritability — Conservative Management &amp; Referral Criteria | unknown | high | pending-review |  |
| s30 | TFCC Irritation — Return to Climbing | unknown | normal | pending-review |  |
| s31 | AC Joint Injury — Return to Sport | unknown | normal | pending-review |  |
| s32 | Massive Rotator Cuff Tear — Surgical Decision | shoulder | medium | pending-review |  |
| s33 | Shoulder Arthroplasty — Pre/Post Surgical Rehab | shoulder | normal | pending-review |  |
| s34 | Olecranon Bursitis — Septic vs Non-Septic Decision | unknown | normal | pending-review |  |
| s35 | Medial Epicondylitis with UCL Consideration | elbow | normal | pending-review |  |
| s36 | Elbow Osteoarthritis — Conservative Management | elbow | normal | pending-review |  |
| s39 | Trigger Finger — Management and Injection Decision | unknown | normal | pending-review |  |
| s40 | Scaphoid Fracture — Acute Presentation | unknown | high | pending-review |  |
| s41 | Ganglion Cyst — Assessment and Management | unknown | normal | pending-review |  |
| s42 | Axial Spondyloarthropathy (AxSpA) — Referral Pathway | unknown | high | pending-review |  |
| s43 | PTS Misdiagnosed as Shoulder — Pattern Recognition | shoulder | normal | pending-review |  |
| s45 | Multifocal Motor Neuropathy — Recognition and Referral | unknown | high | pending-review |  |
| s46 | Craniocervical Instability — RA Patient | cervical | medium | pending-review |  |
| s47 | CGH Contributing to Migraine — Complex Headache Case | cervical | normal | pending-review |  |
| s48 | WAD with Concussion Component — Dual Pathway | unknown | normal | pending-review |  |
| s49 | Sarah — Cervical Radiculopathy in the Workplace | cervical | medium | pending-review |  |
