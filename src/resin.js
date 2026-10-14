import { Vector4 } from 'three';

export function createResinPlanes(seed = 1.7) {
  let state = Math.floor(seed * 1000003) >>> 0;
  const random = () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const planes = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 28; i++) {
    const y = Math.max(-.98, Math.min(.98, 1 - 2 * (i + .5) / 28 + (random() - .5) * .09));
    const angle = i * goldenAngle + seed + (random() - .5) * .8;
    const radius = Math.sqrt(1 - y * y);
    planes.push(new Vector4(radius * Math.cos(angle), y, radius * Math.sin(angle), .86 + random() * .16));
  }
  return planes;
}

// Intersect a ray with the nearest cutting plane. Shared planes give real flat
// faces and an angular outline, with different polygon sizes and edge lengths.
export function resinRadius(x, y, z, planes) {
  let radius = Infinity;
  for (const plane of planes) {
    const facing = x * plane.x + y * plane.y + z * plane.z;
    if (facing > .00001) radius = Math.min(radius, plane.w / facing);
  }
  return radius;
}

export function addResinFacets(material, seed = 1.7) {
  const uniforms = { resinMorph: { value: 0 }, resinPlanes: { value: createResinPlanes(seed) } };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute vec3 resinDirection;\nvarying vec3 vResinDirection;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vResinDirection = resinDirection;
    `);
    shader.fragmentShader = `
      varying vec3 vResinDirection;
      uniform float resinMorph;
      uniform vec4 resinPlanes[28];
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 resinDirection = normalize(vResinDirection);
      float cutRadius = 10000.0;
      float cellId = 0.0;
      float secondRadius = 10000.0;
      float secondId = 0.0;
      vec3 secondDirection = vec3(0.0, 0.0, 1.0);
      vec3 facetDirection = vec3(0.0, 0.0, 1.0);
      for (int i = 0; i < 28; i++) {
        float facing = dot(resinDirection, resinPlanes[i].xyz);
        if (facing > 0.00001) {
          float candidate = resinPlanes[i].w / facing;
          if (candidate < cutRadius) {
            secondRadius = cutRadius;
            secondId = cellId;
            secondDirection = facetDirection;
            cutRadius = candidate;
            facetDirection = resinPlanes[i].xyz;
            cellId = float(i);
          } else if (candidate < secondRadius) {
            secondRadius = candidate;
            secondId = float(i);
            secondDirection = resinPlanes[i].xyz;
          }
        }
      }
      // A narrow polished bevel antialiases the border without hiding the cuts.
      float bevelWidth = max(fwidth(cutRadius) * 1.75, 0.0018);
      float bevel = 0.5 * (1.0 - smoothstep(0.0, bevelWidth, secondRadius - cutRadius));
      facetDirection = normalize(mix(facetDirection, secondDirection, bevel));
      vec3 sphereFacetNormal = normalize(mat3(viewMatrix) * facetDirection) * faceDirection;
      // Carry the same polygon field into the deformed surface's tangent frame.
      // This keeps the patches attached to the ribbon through twists and bends.
      vec3 dx = dFdx(-vViewPosition);
      vec3 dy = dFdy(-vViewPosition);
      vec3 sideX = cross(dy, normal);
      vec3 sideY = cross(normal, dx);
      float determinant = dot(dx, sideX);
      float height = cutRadius * 0.25;
      vec3 surfaceGradient = sign(determinant) * (dFdx(height) * sideX + dFdy(height) * sideY);
      vec3 ribbonFacetNormal = normalize(abs(determinant) * normal - surfaceGradient);
      if (abs(determinant) < 0.0000001) ribbonFacetNormal = normal;
      vec3 facetedNormal = mix(sphereFacetNormal, ribbonFacetNormal, smoothstep(0.05, 0.9, resinMorph));
      normal = normalize(mix(normal, facetedNormal, 0.85));
      nonPerturbedNormal = normalize(mix(nonPerturbedNormal, normal, 0.8));
      float facetTone = mix(fract((cellId + 1.0) * 0.6180339), fract((secondId + 1.0) * 0.6180339), bevel);
      diffuseColor.rgb *= mix(vec3(0.97, 0.9, 0.83), vec3(1.04, 1.08, 1.05), facetTone);
    `);
  };
  material.customProgramCacheKey = () => 'irregular-resin-polygons-v2';
  return uniforms;
}
