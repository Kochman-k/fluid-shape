import { Vector3 } from 'three';

// Broad polygonal reflections on a smooth silhouette, like cut, polished resin.
// The facet influence fades as the same surface stretches into the ribbon.
export function addResinFacets(material) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const seeds = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) seeds.push(new Vector3(x, y, z));
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    seeds.push(new Vector3(0, a / phi, b * phi));
    seeds.push(new Vector3(a / phi, b * phi, 0));
    seeds.push(new Vector3(b * phi, 0, a / phi));
  }
  seeds.forEach(seed => seed.normalize());
  const uniforms = { resinMorph: { value: 0 }, resinFacets: { value: seeds } };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vResinDirection;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vResinDirection = normalize(normal);
    `);
    shader.fragmentShader = `
      varying vec3 vResinDirection;
      uniform float resinMorph;
      uniform vec3 resinFacets[20];
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float closestFacet = -2.0;
      vec3 facetDirection = vec3(0.0, 0.0, 1.0);
      for (int i = 0; i < 20; i++) {
        float affinity = dot(normalize(vResinDirection), resinFacets[i]);
        if (affinity > closestFacet) {
          closestFacet = affinity;
          facetDirection = resinFacets[i];
        }
      }
      vec3 facetNormal = normalize(mat3(viewMatrix) * facetDirection) * faceDirection;
      normal = normalize(mix(normal, facetNormal, 0.48 * (1.0 - resinMorph)));
    `);
  };
  material.customProgramCacheKey = () => 'polished-resin-facets-v1';
  return uniforms;
}
