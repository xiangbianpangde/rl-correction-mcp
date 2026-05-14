
// ============================================================
// Correction Flow - RL Correction MCP 动态背景
// 轻量级粒子流场动画，使用 Anthropic 品牌色
// 内置简化版 Perlin Noise，无需外部依赖
// ============================================================

(function() {
  'use strict';

  // ---- 简化 Perlin Noise 实现 ----
  const PerlinNoise = (function() {
    const permutation = [];
    const p = new Array(512);

    function seed(s) {
      // 使用简单的伪随机种子
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

  // ---- 动画配置 ----
  const CONFIG = {
    particleCount: 80,
    noiseScale: 0.003,
    noiseSpeed: 0.0003,
    maxSpeed: 0.8,
    trailLength: 35,
    fadeAlpha: 4,
    connectionDistance: 100,
    colors: {
      terracotta: [201, 100, 66],   // #c96442
      coral: [217, 119, 87],        // #d97757
      blue: [106, 155, 204],        // #6a9bcc
      green: [120, 140, 93],        // #788c5d
      sand: [200, 196, 182],        // 暖灰
    },
    mouseInfluence: {
      radius: 150,
      strength: 0.5
    }
  };

  let canvas, ctx;
  let particles = [];
  let animId;
  let isVisible = true;
  let time = 0;
  let mouse = { x: null, y: null, active: false };
  let connections = [];

  // ---- 粒子类 ----
  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = 0;
      this.vy = 0;
      this.life = 0;
      this.maxLife = 300 + Math.random() * 400;
      this.trail = [];
      this.size = 0.6 + Math.random() * 0.8;
      this.pulsePhase = Math.random() * Math.PI * 2;

      // 颜色分配：35% 赤陶, 25% 珊瑚, 20% 蓝, 20% 绿
      const r = Math.random();
      if (r < 0.35) {
        this.color = CONFIG.colors.terracotta;
      } else if (r < 0.60) {
        this.color = CONFIG.colors.coral;
      } else if (r < 0.80) {
        this.color = CONFIG.colors.blue;
      } else {
        this.color = CONFIG.colors.green;
      }
      this.baseAlpha = 0.08 + Math.random() * 0.12;
    }

    update() {
      // 使用内置 Perlin Noise - 多层噪声
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

      // 鼠标影响
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

      // 阻尼
      this.vx *= 0.97;
      this.vy *= 0.97;

      // 限速
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > CONFIG.maxSpeed) {
        this.vx = (this.vx / speed) * CONFIG.maxSpeed;
        this.vy = (this.vy / speed) * CONFIG.maxSpeed;
      }

      this.x += this.vx;
      this.y += this.vy;
      this.life++;

      // 记录轨迹
      this.trail.push({ x: this.x, y: this.y, speed: speed });
      if (this.trail.length > CONFIG.trailLength) {
        this.trail.shift();
      }

      // 边界或生命结束 → 重置
      if (this.x < -50 || this.x > canvas.width + 50 ||
          this.y < -50 || this.y > canvas.height + 50 ||
          this.life > this.maxLife) {
        this.reset();
      }
    }

    draw() {
      if (this.trail.length < 2) return;

      const lifeRatio = this.life / this.maxLife;
      // 淡入淡出
      let alpha = this.baseAlpha;
      if (lifeRatio < 0.15) {
        alpha *= lifeRatio / 0.15;
      } else if (lifeRatio > 0.8) {
        alpha *= (1 - lifeRatio) / 0.2;
      }

      // 脉冲效果
      const pulse = Math.sin(time * 0.05 + this.pulsePhase) * 0.3 + 0.7;
      alpha *= pulse;

      // 绘制轨迹（渐变宽度和颜色）
      for (let i = 1; i < this.trail.length; i++) {
        const point = this.trail[i];
        const prevPoint = this.trail[i - 1];
        const segAlpha = alpha * (i / this.trail.length);
        
        // 根据速度调整颜色亮度
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

      // 绘制粒子头部光晕
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

    // 获取当前位置
    getPosition() {
      if (this.trail.length > 0) {
        return this.trail[this.trail.length - 1];
      }
      return { x: this.x, y: this.y };
    }
  }

  // ---- 初始化 ----
  function init() {
    canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resize();

    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push(new Particle());
    }

    // 监听可见性变化，节省性能
    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
      if (isVisible && !animId) animate();
    });

    // 窗口大小变化
    window.addEventListener('resize', resize);
    
    // 鼠标交互
    canvas.parentElement.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
      
      // 鼠标停止移动后逐渐减弱影响
      clearTimeout(mouse.timeout);
      mouse.timeout = setTimeout(() => {
        mouse.active = false;
      }, 100);
    });
    
    canvas.parentElement.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    animate();
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  // ---- 绘制粒子间连线 ----
  function drawConnections() {
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
          ctx.beginPath();
          ctx.moveTo(pos1.x, pos1.y);
          ctx.lineTo(pos2.x, pos2.y);
          ctx.strokeStyle = `rgba(201, 100, 66, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          connections++;
        }
      }
    }
  }

  // ---- 动画循环 ----
  function animate() {
    if (!isVisible) {
      animId = null;
      return;
    }
    animId = requestAnimationFrame(animate);

    // 半透明覆盖实现拖尾淡出
    ctx.fillStyle = `rgba(250, 249, 245, ${CONFIG.fadeAlpha / 100})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    time++;
    
    // 绘制连线（在粒子下方）
    drawConnections();
    
    // 更新和绘制粒子
    for (const p of particles) {
      p.update();
      p.draw();
    }
  }

  // ---- 启动 ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
