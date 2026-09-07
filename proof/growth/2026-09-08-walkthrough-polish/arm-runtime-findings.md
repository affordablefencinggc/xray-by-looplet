# Arm runtime diagnostic

No application edits made. Prepared remote worker now includes `cleanWalkPlan.test.ts` and `FirstPersonArm.test.ts`; no packaging/build started.

Executed the actual `createFirstPersonArm` module against the actual GLB through THREE GLTFLoader/AnimationMixer in Node. The in-memory inspection copy omits texture decoding only; positions, skin, clips and shipped GLB remain unchanged. Camera FOV65, aspect1.45, near0.05, position[0,1.665,2.7], yawPI; actual rig transform(.22,−1.693155,−.08), rotationPI.

`action.paused=true; action.time=t*duration; mixer.update(0)` correctly updates animated bones and skinned vertices. At progress0.3/0.5/0.7, respectively297/303/303 of758 vertices project inside the camera frustum. Near animation endpoints0.15/0.9 only one vertex is in view; meaningful screenshots should capture the middle. Thus the midpoint rig is not generally offscreen under this transform. Actual material is MeshPhysicalMaterial, opacity1, transparent=false, alphaTest0, visible=true, DoubleSide, depthTest=false. GLB alpha mode is defaultOPAQUE, so texture alpha is not a global invisibility explanation.

Likely rendering-order issue handed to root for actual browser confirmation: the opaque arm is submitted to THREE's opaque queue despite renderOrder10000. The source model's translucent appearance is rendered later in its transparent queue. Because the arm does not write depth, those later surfaces can paint over it. `renderOrder` does not move objects across opaque/transparent queues. This follows the installed renderer source directly: `WebGLRenderer.js` renders opaque, then transmissive, then transparent objects (lines1959–1961); `WebGLRenderLists.js` puts a material in the transparent queue only when `material.transparent===true` (lines130–136).

Proposed bounded fixes for root to evaluate visually: give the opacity1 arm material transparent=true so its high renderOrder places it after the world's transparent surfaces, or render a dedicated arm overlay after the world. The diagnostic does not claim either fix has been applied or visually accepted.

Evidence: `arm-runtime-diagnostic.mts` and `arm-runtime-diagnostic.json`; full points, projected sample coordinates, material state, skin bounds and camera-anchor matrix retained. The public model/licence assets were untouched.
