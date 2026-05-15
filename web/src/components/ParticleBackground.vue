<template>
  <div class="particle-background" ref="container">
    <canvas ref="canvas" class="particle-canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useThemeStore } from '../stores/theme';

const canvas = ref(null);
const container = ref(null);
const themeStore = useThemeStore();
let animationId = null;
let particles = [];
let time = 0;
let isVisible = true;
let mouse = { x: null, y: null, active: false };

// ---- 配置 ----
const CONFIG = {
  particleCount: 80,
  noiseScale: 0.003,
  noiseSpeed: 0.0003,
  maxSpeed: 0.8,
  trailLength: 35,
  fadeAlpha: 4,
  connectionDistance: 100,
  colors: {
    light: {
      terracotta: [201, 100, 66],
      coral: [217, 119, 87],
      blue: [106, 155, 204],
      green: [120, 140, 93],
      background: [250, 249, 245]
    },
    dark: {
      terracotta: [220, 120, 86],
      coral: [230, 130, 97],
      blue: [120, 170, 220],
      green: [135, 155, 108],
      background: [20, 20, 19]
    }
  },
  mouseInfluence: {
    radius: 150,
    strength: 0.5
  }
};

// ---- 简化 Perlin Noise 实现 ----
const PerlinNoise = (function() {
  const permutation = [];
  const p = new Array(512);

  function seed(s) {
    const rng = mulberry32(s || 42);
    for (let i = 0; i < 256; i++) permutation[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    for (let i = 0; i < 512; i++) p[i] = permutation[i & 255];
  }

  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t, a, b) { return a + t * (b - a); }
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  function noise3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(w,
      lerp(v,
        lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
        lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))
      ),
      lerp(v,
        lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))
      )
    );
  }

  seed(Date.now());
  return { noise3D, seed };
})();

// ---- 粒子类 ----
class Particle {
  constructor(isDark) {
    this.isDark = isDark;
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.value.width;
    this.y = Math.random() * canvas.value.height;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.maxLife = 300 + Math.random() * 400;
    this.trail = [];
    this.size = 0.6 + Math.random() * 0.8;
    this.pulsePhase = Math.random() * Math.PI * 2;

    const colors = this.isDark ? CONFIG.colors.dark : CONFIG.colors.light;
    const r = Math.random();
    if (r < 0.35) {
      this.color = colors.terracotta;
    } else if (r < 0.60) {
      this.color = colors.coral;
    } else if (r < 0.80) {
      this.color = colors.blue;
    } else {
      this.color = colors.green;
    }
    this.baseAlpha = 0.08 + Math.random() * 0.12;
  }

  update() {
    const n1 = PerlinNoise.noise3D(
      this.x * CONFIG.noiseScale,
      this.y * CONFIG.noiseScale,
      time * CONFIG.noiseSpeed
    );
    const n2 = PerlinNoise.noise3D(
      this.x * CONFIG.noiseScale * 2 + 1000,
      this.y * CONFIG.noiseScale * 2 + 1000,
      time * CONFIG.noiseSpeed * 1.5
    );
    
    const angle = (n1 * 0.7 + n2 * 0.3) * Math.PI * 4;

    this.vx += Math.cos(angle) * 0.08;
    this.vy += Math.sin(angle) * 0.08;

    if (mouse.active) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < CONFIG.mouseInfluence.radius) {
        const force = (1 - dist / CONFIG.mouseInfluence.radius) * CONFIG.mouseInfluence.strength;
        this.vx += (dx / dist) * force * 0.5;
        this.vy += (dy / dist) * force * 0.5;
      }
    }

    this.vx *= 0.97;
    this.vy *= 0.97;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > CONFIG.maxSpeed) {
      this.vx = (this.vx / speed) * CONFIG.maxSpeed;
      this.vy = (this.vy / speed) * CONFIG.maxSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;
    this.life++;

    this.trail.push({ x: this.x, y: this.y, speed: speed });
    if (this.trail.length > CONFIG.trailLength) {
      this.trail.shift();
    }

    if (this.x < -50 || this.x > canvas.value.width + 50 ||
        this.y < -50 || this.y > canvas.value.height + 50 ||
        this.life > this.maxLife) {
      this.reset();
    }
  }

  draw(ctx) {
    if (this.trail.length < 2) return;

    const lifeRatio = this.life / this.maxLife;
    let alpha = this.baseAlpha;
    if (lifeRatio < 0.15) {
      alpha *= lifeRatio / 0.15;
    } else if (lifeRatio > 0.8) {
      alpha *= (1 - lifeRatio) / 0.2;
    }

    const pulse = Math.sin(time * 0.05 + this.pulsePhase) * 0.3 + 0.7;
    alpha *= pulse;

    for (let i = 1; i < this.trail.length; i++) {
      const point = this.trail[i];
      const prevPoint = this.trail[i - 1];
      const segAlpha = alpha * (i / this.trail.length);
      
      const speedFactor = Math.min(point.speed / CONFIG.maxSpeed, 1);
      const r = Math.min(255, this.color[0] + speedFactor * 30);
      const g = Math.min(255, this.color[1] + speedFactor * 30);
      const b = Math.min(255, this.color[2] + speedFactor * 30);
      
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${segAlpha})`;
      ctx.lineWidth = this.size * (i / this.trail.length) * (0.5 + speedFactor * 0.5);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    const head = this.trail[this.trail.length - 1];
    const headAlpha = alpha * 0.5;
    const gradient = ctx.createRadialGradient(
      head.x, head.y, 0,
      head.x, head.y, this.size * 3
    );
    gradient.addColorStop(0, `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${headAlpha})`);
    gradient.addColorStop(1, `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(head.x, head.y, this.size * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  getPosition() {
    if (this.trail.length > 0) {
      return this.trail[this.trail.length - 1];
    }
    return { x: this.x, y: this.y };
  }

  updateTheme(isDark) {
    this.isDark = isDark;
    const colors = isDark ? CONFIG.colors.dark : CONFIG.colors.light;
    const r = Math.random();
    if (r < 0.35) {
      this.color = colors.terracotta;
    } else if (r < 0.60) {
      this.color = colors.coral;
    } else if (r < 0.80) {
      this.color = colors.blue;
    } else {
      this.color = colors.green;
    }
  }
}

function drawConnections(ctx) {
  const maxConnections = 3;
  
  for (let i = 0; i < particles.length; i++) {
    let connections = 0;
    const p1 = particles[i];
    const pos1 = p1.getPosition();
    
    for (let j = i + 1; j < particles.length && connections < maxConnections; j++) {
      const p2 = particles[j];
      const pos2 = p2.getPosition();
      
      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < CONFIG.connectionDistance) {
        const alpha = (1 - dist / CONFIG.connectionDistance) * 0.08;
        const colors = themeStore.isDark ? CONFIG.colors.dark : CONFIG.colors.light;
        ctx.beginPath();
        ctx.moveTo(pos1.x, pos1.y);
        ctx.lineTo(pos2.x, pos2.y);
        ctx.strokeStyle = `rgba(${colors.terracotta[0]}, ${colors.terracotta[1]}, ${colors.terracotta[2]}, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        connections++;
      }
    }
  }
}

function animate() {
  if (!isVisible) {
    animationId = null;
    return;
  }
  
  if (!canvas.value) return;
  
  const ctx = canvas.value.getContext('2d');
  const w = canvas.value.width;
  const h = canvas.value.height;
  
  const colors = themeStore.isDark ? CONFIG.colors.dark : CONFIG.colors.light;
  ctx.fillStyle = `rgba(${colors.background[0]}, ${colors.background[1]}, ${colors.background[2]}, ${CONFIG.fadeAlpha / 100})`;
  ctx.fillRect(0, 0, w, h);

  time++;
  
  drawConnections(ctx);
  
  for (const p of particles) {
    p.update();
    p.draw(ctx);
  }
  
  animationId = requestAnimationFrame(animate);
}

function resize() {
  if (!canvas.value || !container.value) return;
  const rect = container.value.getBoundingClientRect();
  canvas.value.width = rect.width;
  canvas.value.height = rect.height;
}

function handleVisibilityChange() {
  isVisible = !document.hidden;
  if (isVisible && !animationId) animate();
}

function handleMouseMove(e) {
  if (!canvas.value || !container.value) return;
  const rect = canvas.value.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  mouse.active = true;
  
  clearTimeout(mouse.timeout);
  mouse.timeout = setTimeout(() => {
    mouse.active = false;
  }, 100);
}

function handleMouseLeave() {
  mouse.active = false;
}

// 监听主题变化
watch(() => themeStore.isDark, (newValue) => {
  particles.forEach(p => p.updateTheme(newValue));
});

onMounted(() => {
  resize();
  
  const isDark = themeStore.isDark;
  for (let i = 0; i < CONFIG.particleCount; i++) {
    particles.push(new Particle(isDark));
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('resize', resize);
  
  if (container.value) {
    container.value.addEventListener('mousemove', handleMouseMove);
    container.value.addEventListener('mouseleave', handleMouseLeave);
  }
  
  animate();
});

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('resize');
  
  if (container.value) {
    container.value.removeEventListener('mousemove', handleMouseMove);
    container.value.removeEventListener('mouseleave', handleMouseLeave);
  }
});
</script>

<style scoped>
.particle-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.particle-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
