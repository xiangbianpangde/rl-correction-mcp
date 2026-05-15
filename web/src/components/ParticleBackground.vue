<template>
  <div class="particle-background">
    <canvas ref="canvas" class="particle-canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const canvas = ref(null);
let animationId = null;
let ribbons = [];
let time = 0;

const config = {
  ribbonCount: 5,
  pointsPerRibbon: 80,
  amplitude: 60,
  frequency: 0.003,
  speed: 0.0005,
  colors: [
    [217, 119, 87, 0.15],   // 赤陶橙
    [106, 155, 204, 0.12],  // 蓝色
    [120, 140, 93, 0.12],   // 绿色
    [196, 92, 62, 0.10],    // 深橙
    [217, 119, 87, 0.08],   // 淡橙
  ]
};

class Ribbon {
  constructor(index, w, h) {
    this.index = index;
    this.points = [];
    this.color = config.colors[index % config.colors.length];
    this.offsetY = (h / (config.ribbonCount + 1)) * (index + 1);
    this.phase = index * 0.8;
    this.thickness = 2 + Math.random() * 3;
    this.noiseOffset = index * 1000;
    
    // 初始化点
    for (let i = 0; i <= config.pointsPerRibbon; i++) {
      this.points.push({
        x: (w / config.pointsPerRibbon) * i,
        y: this.offsetY,
        baseY: this.offsetY
      });
    }
  }

  update(w, h, t) {
    const freq = config.frequency * (1 + this.index * 0.1);
    const amp = config.amplitude * (1 + Math.sin(t * 0.5 + this.index) * 0.3);
    
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      const xNorm = point.x / w;
      
      // 多层正弦波叠加产生有机流动感
      const wave1 = Math.sin(xNorm * Math.PI * 2 + t * config.speed + this.phase);
      const wave2 = Math.sin(xNorm * Math.PI * 4 + t * config.speed * 1.3 + this.phase * 1.5) * 0.5;
      const wave3 = Math.sin(xNorm * Math.PI * 6 + t * config.speed * 0.7 + this.phase * 0.8) * 0.25;
      
      // 添加垂直漂移
      const drift = Math.sin(t * 0.0003 + this.index) * 30;
      
      point.y = point.baseY + (wave1 + wave2 + wave3) * amp + drift;
    }
  }

  draw(ctx) {
    const [r, g, b, a] = this.color;
    
    // 绘制主线条
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    
    // 使用贝塞尔曲线平滑连接
    for (let i = 1; i < this.points.length - 1; i++) {
      const p0 = this.points[i - 1];
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      
      const cpX = (p0.x + p1.x) / 2;
      const cpY = (p0.y + p1.y) / 2;
      
      ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    }
    
    ctx.lineTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
    
    // 渐变描边
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
    gradient.addColorStop(0, `rgba(${r},${g},${b},0)`);
    gradient.addColorStop(0.2, `rgba(${r},${g},${b},${a})`);
    gradient.addColorStop(0.5, `rgba(${r},${g},${b},${a * 1.5})`);
    gradient.addColorStop(0.8, `rgba(${r},${g},${b},${a})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = this.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // 绘制发光效果
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length - 1; i++) {
      const p0 = this.points[i - 1];
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    }
    ctx.lineTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
    
    ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.3})`;
    ctx.lineWidth = this.thickness * 4;
    ctx.stroke();
  }
}

function animate() {
  if (!canvas.value) return;
  
  const ctx = canvas.value.getContext('2d');
  const w = canvas.value.width;
  const h = canvas.value.height;
  
  // 半透明清除，产生拖尾效果
  ctx.fillStyle = 'rgba(250, 249, 245, 0.15)';
  ctx.fillRect(0, 0, w, h);
  
  time += 1;
  
  ribbons.forEach(ribbon => {
    ribbon.update(w, h, time);
    ribbon.draw(ctx);
  });
  
  animationId = requestAnimationFrame(animate);
}

function resize() {
  if (!canvas.value) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.value.width = w;
  canvas.value.height = h;
  
  // 重新初始化 ribbons
  ribbons = [];
  for (let i = 0; i < config.ribbonCount; i++) {
    ribbons.push(new Ribbon(i, w, h));
  }
}

onMounted(() => {
  resize();
  animate();
  window.addEventListener('resize', resize);
});

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
  window.removeEventListener('resize', resize);
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
