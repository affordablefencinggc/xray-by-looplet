# Crown Wharf A4 structural review model

Regenerate: node scripts/build-crown-wharf-model.mjs

Source: https://docs.planning.org.uk/20260225/208/TAEHTIJYHRL00/qkrdx8m88c4v5zqq.pdf
SHA-256: 32a99e7680a94f7690bc1639913563f279a3452bcb9f0dd4e4ef63997ab2639a

- Crown Wharf Canning Town Block A4, reconstructed from the Arup structural appendix (PDF pages 27–36). This is not Altitude, a BIM import or an as-built model.
- Review visualization only. Written grid chains establish the plan scale; manually traced positions remain approximate. Source drawings say “Do not scale”. Do not derive construction dimensions or procurement quantities from these meshes.
- Ground +5.325 m, level 01 +10.725 m, levels 02–30 +14.025 through +98.025 m; typical spacing 3 m. Level 31 reference +101.225 m with stepped slab simplified. Main roof +104.600 m; lift caps +106.750 and +107.780 m; highest indicative upstand +108.690 m. These are drawing elevations, not building height above sea level inferred from images.
- Ground and level 01 terraces are simplified; lower ground, foundations, pile caps, beams, stairs, reinforcement, facade, glazing, fitout and MEP are omitted. Ground platform is flattened despite multiple documented levels.
- Typical p34 column positions and sizes are repeated indicatively below level 18. Lower-storey changes, transfers and beam connections are not reconstructed; do not use this model for column counts or concrete quantities.
- Upper column centers and rotations are approximate. Core walls, shaft enclosures and balcony projections are simplified. Door openings and local slab steps are omitted; this geometry is not suitable for concrete volume calculations.
- Colors distinguish model categories; they are not specified finishes. Mesh totals are rendering parts, not unique physical components or stock quantities. No nuts, bolts, anchors, mass or storage volume is asserted.
- Drawing status S5 Suitable for Stage Approval. Revision tables include Construction Issue. Verify current coordinated drawings before engineering use.

2180 render meshes; 32 ground/numbered floor references plus roof. Original document ownership remains with its authors. Source provided for local project review, no redistribution licence asserted.
