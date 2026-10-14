import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A feather is a closed, ridged polygon, with a different normal on every face.
function featherGeometry() {
  const outline = [[0,.15,0],[-.35,.05,0],[-.42,-.35,-.01],[-.3,-.83,-.035],[-.08,-1.12,-.06],[.13,-1.07,-.045],[.36,-.64,-.01],[.33,-.12,0]];
  const vertices = [];
  for (let i=0;i<outline.length;i++) {
    const a=outline[i], b=outline[(i+1)%outline.length];
    vertices.push(0,-.35,.045,...a,...b, 0,-.4,-.06,...b,...a);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.computeVertexNormals(); return g;
}
function solid(vertices, faces) {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(faces.flatMap(face=>face.flatMap(i=>vertices[i])),3));
  g.computeVertexNormals(); return g;
}
function buildOwl() {
  const owl=new THREE.Group(), batches=new Map();
  const colors=['#ec3e17','#f44f20','#db2b0e','#ff6c35','#f96b38','#f78d56','#bf270e'];
  const mats=colors.map(color=>new THREE.MeshPhysicalMaterial({color,metalness:.3,roughness:.17,clearcoat:1,clearcoatRoughness:.16,flatShading:true}));
  const cream=new THREE.MeshPhysicalMaterial({color:'#ffb693',metalness:.12,roughness:.24,clearcoat:1,flatShading:true});
  const copper=new THREE.MeshPhysicalMaterial({color:'#c96b16',metalness:.8,roughness:.21,clearcoat:1});
  const dark=new THREE.MeshPhysicalMaterial({color:'#1e1009',metalness:.45,roughness:.18,clearcoat:1});
  const pupil=new THREE.MeshPhysicalMaterial({color:'#070606',roughness:.09,clearcoat:1});
  const add=(geo,mat,pos,scale=[1,1,1],rotation=[0,0,0])=>{
    const m=new THREE.Mesh(geo,mat); m.position.set(...pos);m.scale.set(...scale);m.rotation.set(...rotation);m.updateMatrix();
    const g=(geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m.matrix); g.deleteAttribute('uv'); if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);
  };
  const ico=new THREE.IcosahedronGeometry(1,2);
  add(ico,mats[2],[0,-.45,0],[.96,1.47,.66]);
  add(ico,mats[0],[0,1.08,0],[1.12,.96,.73]);
  const feather=featherGeometry();
  let n=0;
  const color=(i)=>mats[((i*17+Math.floor(i/7)*3)%colors.length)];
  // Overlapping feathers wrap all the way around the body, including its back.
  for(let row=0;row<7;row++) {
    const t=(row+.5)/8, y=.55-t*2.65;
    const r=Math.sqrt(Math.max(.13,1-Math.pow((y+.45)/1.65,2)));
    const count=18+(row%2)*2;
    for(let j=0;j<count;j++) {
      const a=j/count*Math.PI*2+(row%2)*.15;
      const x=Math.sin(a)*r*.98,z=Math.cos(a)*r*.69;
      add(feather,color(n++),[x,y,z],[.43+(row%3)*.025,.53+row*.025,1],[.12*Math.cos(a),a,Math.sin(a)*.13]);
    }
  }
  // Separate wing silhouettes and long flight feathers give the owl its tapered profile.
  for(const side of [-1,1]) {
    add(ico,mats[2],[side*.86,-.45,-.05],[.47,1.27,.55],[0,0,side*.17]);
    for(let row=0;row<4;row++)for(let col=0;col<5;col++) {
      const a=side*(.76+col*.23);
      const y=.37-row*.43;
      add(feather,color(n++),[Math.sin(a)*(1.31-row*.045),y,Math.cos(a)*.77],[.55,1.03+row*.07,1.1],[.08,a,side*(.12+col*.025)]);
    }
    // Back coverts and tail: the sculpture remains complete when rotated.
    for(let k=0;k<4;k++) add(feather,color(n++),[side*(.12+k*.12),-1.42,-.44-k*.025],[.38,.85,1],[.18,Math.PI,side*.1]);
    // The pale facial discs are low-poly, shallow ellipsoids rather than flat stickers.
    add(new THREE.SphereGeometry(1,14,9),cream,[side*.51,1.12,.61],[.54,.61,.16],[0,side*.18,side*-.12]);
    const ringPosition=[side*.5,1.2,.798];
    add(new THREE.TorusGeometry(.228,.062,8,32),mats[6],ringPosition);
    add(new THREE.TorusGeometry(.205,.044,10,40),copper,[side*.5,1.2,.842]);
    add(new THREE.SphereGeometry(1,32,20),pupil,[side*.5,1.2,.859],[.164,.164,.07]);
    // Angular swept brow / ear tuft, with a raised central fold.
    const v=[[0,1.48,.77],[side*.36,1.92,.63],[side*1.4,2.34,.02],[side*1.05,1.65,.31],[side*.64,1.64,.83],[side*.68,1.9,.58],[side*.64,1.7,.05]];
    add(solid(v,[[0,4,5],[0,5,1],[1,5,2],[2,5,4],[2,4,3],[1,2,6],[2,3,6],[3,4,6],[4,0,6],[0,1,6]]),mats[0],[0,0,0]);
    // Fine cheek feathers frame the face without covering the eyes.
    for(let k=0;k<5;k++)add(feather,color(n++),[side*(.45+k*.13),.67-k*.02,.73-k*.06],[.32,.3,1],[0,side*.3,side*(.7-k*.09)]);
  }
  add(solid([[0,1.12,.8],[-.14,.81,.86],[.14,.81,.86],[0,.45,.9],[0,.8,1.08],[0,.85,.65]],[[0,1,4],[0,4,2],[1,3,4],[2,4,3],[0,5,1],[0,2,5],[1,5,3],[2,3,5]]),dark,[0,0,0]);
  // Small bronze talons under the feathered body.
  for(const side of [-1,1])for(let j=0;j<3;j++)add(new THREE.CapsuleGeometry(.035,.2,3,6),copper,[side*.35+(j-1)*.09,-1.99,.16+j*.02],[1,1,1],[Math.PI/2,0,0]);
  for(const [mat,geometries] of batches) {
    const mesh=new THREE.Mesh(mergeGeometries(geometries),mat);mesh.castShadow=true;mesh.receiveShadow=true;owl.add(mesh);
    geometries.forEach(g=>g.dispose());
  }
  ico.dispose();feather.dispose();
  owl.rotation.y=-.12;
  return owl;
}

export class OwlExperience {
  constructor(container) {
    this.container=container;this.active=false;this.autoRotate=false;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Polygonowa sowa 3D. Przeciągnij, aby obrócić.');
    this.renderer.domElement.tabIndex=0;
    this.scene=new THREE.Scene();
    const pmrem=new THREE.PMREMGenerator(this.renderer), room=new RoomEnvironment();
    this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.7;
    room.dispose();pmrem.dispose();
    this.camera=new THREE.PerspectiveCamera(35,1,.1,80);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.enablePan=false;
    this.controls.minDistance=5.8;this.controls.maxDistance=14;this.controls.minPolarAngle=.45;this.controls.maxPolarAngle=1.9;this.controls.autoRotateSpeed=.6;
    this.owl=buildOwl();this.scene.add(this.owl);
    this.scene.add(new THREE.HemisphereLight('#fff0ce','#b03c15',1.1));
    const key=new THREE.DirectionalLight('#fff1df',3);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.035;key.shadow.bias=-.0002;key.shadow.radius=4;this.scene.add(key);
    const rim=new THREE.DirectionalLight('#ffcf71',3);rim.position.set(3,3,-3);this.scene.add(rim);
    const fill=new THREE.DirectionalLight('#ffe5df',1);fill.position.set(3,1,4);this.scene.add(fill);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#8f290e',opacity:.085}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.11;floor.receiveShadow=true;this.scene.add(floor);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;
    const ctx=contactCanvas.getContext('2d'), gradient=ctx.createRadialGradient(64,64,5,64,64,64);
    gradient.addColorStop(0,'rgba(125,40,10,.25)');gradient.addColorStop(.45,'rgba(125,40,10,.12)');gradient.addColorStop(1,'rgba(125,40,10,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const contact=new THREE.Mesh(new THREE.PlaneGeometry(4,2.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contactCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-2.105;this.scene.add(contact);
    this.reset();
    this.renderer.domElement.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      const offset=this.camera.position.clone().sub(this.controls.target),s=new THREE.Spherical().setFromVector3(offset);
      s.theta+=event.key==='ArrowLeft'?-.15:event.key==='ArrowRight'?.15:0;
      s.phi=THREE.MathUtils.clamp(s.phi+(event.key==='ArrowUp'?-.1:event.key==='ArrowDown'?.1:0),.45,1.9);
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s));this.controls.update();this.needsRender=true;
    });
    this.renderer.domElement.dataset.ready='true';
    this.renderer.domElement.dataset.feathers='190';
    this.last=performance.now();this.animate=this.animate.bind(this);requestAnimationFrame(this.animate);
  }
  resize() {
    const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;
    this.renderer.setSize(width,height);this.camera.aspect=width/height;
    // Off-axis framing reserves space for the material card on desktop.
    this.camera.setViewOffset(width,height,width>800?width*.065:0,width>800?0:-height*.035,width,height);
    this.camera.updateProjectionMatrix();this.needsRender=true;
  }
  reset() {
    const mobile=window.innerWidth<801;
    this.camera.position.set(2.1,1.15,mobile?9.7:9.3);this.controls.target.set(0,.12,0);this.controls.update();this.needsRender=true;this.resize();
  }
  setActive(active) {this.active=active;this.needsRender=true;if(active)this.resize();}
  capture() {
    this.renderer.render(this.scene,this.camera);
    const source=this.renderer.domElement, canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(canvas.width*.78,canvas.height*.36,0,canvas.width*.5,canvas.height*.5,canvas.width*.8);
    gradient.addColorStop(0,'#fff1b1');gradient.addColorStop(.4,'#ffd68d');gradient.addColorStop(.75,'#f4a26d');gradient.addColorStop(1,'#d86740');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0);return canvas.toDataURL('image/png');
  }
  animate(now) {
    requestAnimationFrame(this.animate);const dt=Math.min((now-this.last)/1000,.05);this.last=now;if(!this.active)return;
    this.controls.autoRotate=this.autoRotate&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    const changed=this.controls.update(dt);
    if(changed || this.needsRender) { this.renderer.render(this.scene,this.camera);this.needsRender=false; }
    this.renderer.domElement.dataset.azimuth=this.controls.getAzimuthalAngle().toFixed(3);
  }
}
