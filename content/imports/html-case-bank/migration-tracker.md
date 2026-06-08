# Legacy Station Migration Tracker

This file tracks conversion of extracted legacy stations into the new guided case system.

Generated from:

- `content/imports/html-case-bank/extracted/stations/*.md`
- `content/cases/**/*.mdx`

## Status labels

- `pending-review` - extracted station with no matching generated case
- `draft-created` - matching guided case exists with `status: "draft"`
- `converted` - matching guided case exists with `status: "published"`
- `archived` - matching guided case exists with `status: "archived"`

## Station migration status

| Legacy ID | Title | Region | Priority | Status | Target / Notes |
|---|---|---|---|---|---|
| s1 | Cervical Radiculopathy | unknown | medium | pending-review |  |
| s2 | Degenerative Cervical Myelopathy | unknown | high | pending-review |  |
| s3 | Whiplash Associated Disorder | unknown | normal | pending-review |  |
| s4 | Cervicogenic Headache | cervical | normal | pending-review |  |
| s5 | Rotator Cuff Related Shoulder Pain | unknown | medium | pending-review |  |
| s6 | Adhesive Capsulitis | unknown | normal | pending-review |  |
| s7 | Shoulder Instability | unknown | medium | pending-review |  |
| s8 | Neuralgic Amyotrophy (Parsonage-Turner) | unknown | medium | pending-review |  |
| s9 | Thoracic Pain: Visceral vs MSK | unknown | high | pending-review |  |
| s10 | Thoracic Osteoporotic Fracture | unknown | high | pending-review |  |
| s11 | Thumb Base Osteoarthritis | unknown | normal | pending-review |  |
| s12 | Acute Thumb UCL Injury | unknown | normal | pending-review |  |
| s13 | Hand Osteoarthritis | unknown | normal | pending-review |  |
| s14 | General Red Flag Framework | unknown | high | pending-review |  |
| s15 | Headache / Cervical Safety Screen | cervical | high | pending-review |  |
| s16 | Modern Manual Therapy Justification | unknown | normal | pending-review |  |
| s17 | Lateral Epicondylitis — Injection Dilemma | unknown | medium | pending-review |  |
| s18 | Cubital Tunnel Syndrome | unknown | normal | pending-review |  |
| s19 | Thoracic Outlet Syndrome — nTOS | unknown | medium | pending-review |  |
| s20 | Degenerative Cervical Myelopathy — Early Presentation | unknown | high | converted | content/cases/cervical/early-degenerative-cervical-myelopathy-case-01.mdx; reviewStatus: reviewed |
| s21 | Parsonage-Turner Syndrome — Extended Case | unknown | medium | pending-review |  |
| s22 | Osteoporotic Vertebral Fracture — Management | unknown | high | pending-review |  |
| s23 | Cervical Radiculopathy — Official OSCE Format | unknown | medium | pending-review |  |
| s24 | DCM — Escalation &amp; Communication | unknown | normal | pending-review |  |
| s25 | Neurogenic TOS + Vascular Safety Net | unknown | normal | pending-review |  |
| s26 | WAD — Biopsychosocial Management | unknown | normal | pending-review |  |
| s27 | CGH — Return to Running | unknown | normal | pending-review |  |
| s28 | Distal Biceps Rupture — Referral Decision | elbow | high | converted | content/cases/elbow/distal-biceps-rupture-case-01.mdx; reviewStatus: reviewed |
| s29 | CTS High Irritability — Conservative Management &amp; Referral Criteria | wrist-hand | high | pending-review |  |
| s30 | TFCC Irritation — Return to Climbing | wrist-hand | normal | pending-review |  |
| s31 | AC Joint Injury — Return to Sport | unknown | normal | pending-review |  |
| s32 | Massive Rotator Cuff Tear — Surgical Decision | unknown | medium | pending-review |  |
| s33 | Shoulder Arthroplasty — Pre/Post Surgical Rehab | shoulder | normal | pending-review |  |
| s34 | Olecranon Bursitis — Septic vs Non-Septic Decision | elbow | high | pending-review |  |
| s35 | Medial Epicondylitis with UCL Consideration | elbow | normal | pending-review |  |
| s36 | Elbow Osteoarthritis — Conservative Management | elbow | normal | pending-review |  |
| s39 | Trigger Finger — Management and Injection Decision | unknown | normal | pending-review |  |
| s40 | Scaphoid Fracture — Acute Presentation | wrist-hand | high | draft-created | content/cases/wrist - hand/scaphoid-fracture-acute-presentation-case-01.mdx; reviewStatus: needs-review |
| s41 | Ganglion Cyst — Assessment and Management | wrist-hand | normal | pending-review |  |
| s42 | Axial Spondyloarthropathy (AxSpA) — Referral Pathway | unknown | high | draft-created | content/cases/lumbar/axial-spondyloarthropathy-axspa-referral-pathway-case-01.mdx; reviewStatus: needs-review |
| s43 | PTS Misdiagnosed as Shoulder — Pattern Recognition | shoulder | medium | pending-review |  |
| s44 | Visceral Referral Mimicking Thoracic MSK | unknown | high | converted | content/cases/thoracic/visceral-referral-mimicking-thoracic-msk-case-01.mdx; reviewStatus: reviewed |
| s45 | Multifocal Motor Neuropathy — Recognition and Referral | wrist-hand | high | pending-review |  |
| s46 | Craniocervical Instability — RA Patient | cervical | high | draft-created | content/cases/cervical/craniocervical-instability-ra-patient-case-01.mdx; reviewStatus: needs-review |
| s47 | CGH Contributing to Migraine — Complex Headache Case | cervical | medium | pending-review |  |
| s48 | WAD with Concussion Component — Dual Pathway | cervical | medium | pending-review |  |
| s49 | Sarah — Cervical Radiculopathy in the Workplace | unknown | medium | pending-review |  |