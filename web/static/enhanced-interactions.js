/**
 * RL Correction MCP Web UI - 增强交互效果
 * 添加动态动画、微交互和视觉反馈
 */

(function() {
  'use strict';

  // ============================================================
  // 动画工具函数
  // ============================================================
  
  const AnimationUtils = {
    // 缓动函数
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeOutQuart: t => 1 - Math.pow(1 - t, 4),
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutBack: t => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    
    // 数字动画
    animateNumber: function(element, targetValue, duration = 800) {
      const startValue = parseInt(element.textContent) || 0;
      const startTime = performance.now();
      
      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = AnimationUtils.easeOutQuart(progress);
        const current = Math.round(startValue + (targetValue - startValue) * eased);
        element.textContent = current;
        
        if (progress < 1) {
          requestAnimationFrame(update);
        }
      }
      
      requestAnimationFrame(update);
    },
    
    // 淡入动画
    fadeIn: function(element, duration = 300) {
      element.style.opacity = '0';
      element.style.display = '';
      const startTime = performance.now();
      
      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        element.style.opacity = progress;
        
        if (progress < 1) {
          requestAnimationFrame(update);
        }
      }
      
      requestAnimationFrame(update);
    },
    
    // 滑入动画
    slideIn: function(element, direction = 'up', duration = 400) {
      const transforms = {
        up: 'translateY(20px)',
        down: 'translateY(-20px)',
        left: 'translateX(20px)',
        right: 'translateX(-20px)'
      };
      
      element.style.opacity = '0';
      element.style.transform = transforms[direction];
      element.style.transition = `all ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'translate(0)';
      });
      
      setTimeout(() => {
        element.style.transition = '';
      }, duration);
    },
    
    // 脉冲动画
    pulse: function(element, scale = 1.05, duration = 200) {
      element.style.transition = `transform ${duration}ms ease`;
      element.style.transform = `scale(${scale})`;
      
      setTimeout(() => {
        element.style.transform = 'scale(1)';
        setTimeout(() => {
          element.style.transition = '';
        }, duration);
      }, duration);
    },
    
    // 抖动动画（错误提示）
    shake: function(element) {
      element.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
      setTimeout(() => {
        element.style.animation = '';
      }, 500);
    }
  };

  // ============================================================
  // 骨架屏加载效果
  // ============================================================
  
  const SkeletonLoader = {
    createCard: function() {
      return `
        <div class="skeleton-card">
          <div class="skeleton-header">
            <div class="skeleton-badge"></div>
          </div>
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
          <div class="skeleton-tags">
            <div class="skeleton-tag"></div>
            <div class="skeleton-tag"></div>
          </div>
        </div>
      `;
    },
    
    createStatCard: function() {
      return `
        <div class="skeleton-stat-card">
          <div class="skeleton-icon"></div>
          <div class="skeleton-content">
            <div class="skeleton-value"></div>
            <div class="skeleton-label"></div>
          </div>
        </div>
      `;
    },
    
    show: function(container, type = 'card', count = 3) {
      const creator = type === 'stat' ? this.createStatCard : this.createCard;
      container.innerHTML = Array(count).fill(0).map(() => creator()).join('');
      container.classList.add('skeleton-active');
    },
    
    hide: function(container) {
      container.classList.remove('skeleton-active');
    }
  };

  // ============================================================
  // 增强的悬停效果
  // ============================================================
  
  const HoverEffects = {
    init: function() {
      // 卡片 3D 倾斜效果
      document.querySelectorAll('.record-card, .stat-card').forEach(card => {
        card.addEventListener('mousemove', this.handleTilt);
        card.addEventListener('mouseleave', this.resetTilt);
      });
      
      // 按钮涟漪效果
      document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', this.createRipple);
      });
      
      // 导航项悬停
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('mouseenter', this.navHover);
      });
    },
    
    handleTilt: function(e) {
      const card = e.currentTarget;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
      card.style.transition = 'transform 0.1s ease';
    },
    
    resetTilt: function(e) {
      const card = e.currentTarget;
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
      card.style.transition = 'transform 0.3s ease';
    },
    
    createRipple: function(e) {
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: rippleEffect 0.6s ease-out;
        pointer-events: none;
      `;
      
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    },
    
    navHover: function(e) {
      const item = e.currentTarget;
      if (item.classList.contains('active')) return;
      
      // 添加微妙的滑动指示器
      const indicator = item.querySelector('.nav-indicator') || document.createElement('span');
      indicator.className = 'nav-indicator';
      indicator.style.cssText = `
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 0;
        background: var(--terracotta);
        border-radius: 0 2px 2px 0;
        transition: height 0.3s ease;
      `;
      
      if (!item.querySelector('.nav-indicator')) {
        item.style.position = 'relative';
        item.appendChild(indicator);
      }
      
      requestAnimationFrame(() => {
        indicator.style.height = '60%';
      });
      
      item.addEventListener('mouseleave', () => {
        indicator.style.height = '0';
      }, { once: true });
    }
  };

  // ============================================================
  // 页面过渡动画
  // ============================================================
  
  const PageTransitions = {
    init: function() {
      // 监听视图切换
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const view = mutation.target;
            if (!view.classList.contains('hidden') && view.classList.contains('view')) {
              this.animateViewEntry(view);
            }
          }
        });
      });
      
      document.querySelectorAll('.view').forEach(view => {
        observer.observe(view, { attributes: true });
      });
    },
    
    animateViewEntry: function(view) {
      const children = view.children;
      Array.from(children).forEach((child, index) => {
        child.style.opacity = '0';
        child.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
          child.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
          child.style.opacity = '1';
          child.style.transform = 'translateY(0)';
          
          setTimeout(() => {
            child.style.transition = '';
          }, 400);
        }, index * 80);
      });
    }
  };

  // ============================================================
  // 增强的 Toast 通知
  // ============================================================
  
  const EnhancedToast = {
    show: function(message, type = 'success', duration = 4000) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      
      const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
      toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
      `;
      
      // 添加样式
      toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        background: var(--ivory);
        border: 1px solid var(--color-border-prominent);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        animation: toastSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      `;
      
      container.appendChild(toast);
      
      // 自动移除
      setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }, duration);
      
      return toast;
    }
  };

  // ============================================================
  // 搜索交互增强
  // ============================================================
  
  const SearchEnhancements = {
    init: function() {
      // 搜索框聚焦效果
      document.querySelectorAll('.search-box input').forEach(input => {
        input.addEventListener('focus', this.onSearchFocus);
        input.addEventListener('blur', this.onSearchBlur);
        input.addEventListener('input', this.onSearchInput);
      });
    },
    
    onSearchFocus: function(e) {
      const box = e.target.closest('.search-box');
      box.style.transform = 'scale(1.02)';
      box.style.transition = 'transform 0.3s ease';
      
      // 添加发光效果
      e.target.style.boxShadow = '0 0 0 3px rgba(217, 119, 87, 0.15)';
    },
    
    onSearchBlur: function(e) {
      const box = e.target.closest('.search-box');
      box.style.transform = 'scale(1)';
      e.target.style.boxShadow = '';
    },
    
    onSearchInput: function(e) {
      const input = e.target;
      const clearBtn = input.parentElement.querySelector('.search-clear');
      
      if (input.value && !clearBtn) {
        const btn = document.createElement('button');
        btn.className = 'search-clear';
        btn.innerHTML = '×';
        btn.style.cssText = `
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--warm-sand);
          border: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          color: var(--charcoal-warm);
          opacity: 0;
          animation: fadeIn 0.2s ease forwards;
        `;
        btn.onclick = () => {
          input.value = '';
          input.focus();
          btn.remove();
          input.dispatchEvent(new Event('input'));
        };
        input.parentElement.appendChild(btn);
      } else if (!input.value && clearBtn) {
        clearBtn.remove();
      }
    }
  };

  // ============================================================
  // 模态框动画增强
  // ============================================================
  
  const ModalEnhancements = {
    init: function() {
      // 监听模态框显示
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const modal = mutation.target;
            if (modal.classList.contains('modal') || modal.classList.contains('drawer')) {
              if (!modal.classList.contains('hidden')) {
                this.animateOpen(modal);
              }
            }
          }
        });
      });
      
      document.querySelectorAll('.modal, .drawer').forEach(modal => {
        observer.observe(modal, { attributes: true });
      });
    },
    
    animateOpen: function(modal) {
      const content = modal.querySelector('.modal-content, .drawer-content');
      if (!content) return;
      
      if (modal.classList.contains('drawer')) {
        // 抽屉从右侧滑入
        content.style.animation = 'drawerSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      } else {
        // 模态框缩放淡入
        content.style.opacity = '0';
        content.style.transform = 'scale(0.9) translateY(20px)';
        
        requestAnimationFrame(() => {
          content.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
          content.style.opacity = '1';
          content.style.transform = 'scale(1) translateY(0)';
        });
      }
    }
  };

  // ============================================================
  // 添加 CSS 动画关键帧
  // ============================================================
  
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes rippleEffect {
        to {
          transform: scale(2.5);
          opacity: 0;
        }
      }
      
      @keyframes shake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
        40%, 60% { transform: translate3d(3px, 0, 0); }
      }
      
      @keyframes toastSlideIn {
        from {
          opacity: 0;
          transform: translateX(100%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }
      
      @keyframes toastSlideOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }
      
      @keyframes drawerSlideIn {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      /* 骨架屏样式 */
      .skeleton-active .skeleton-card,
      .skeleton-active .skeleton-stat-card {
        background: var(--pure-white);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
        border: 1px solid var(--color-border);
      }
      
      .skeleton-active [class^="skeleton-"] {
        background: linear-gradient(90deg, var(--warm-sand) 25%, #f0eee6 50%, var(--warm-sand) 75%);
        background-size: 200% 100%;
        animation: skeletonLoading 1.5s infinite;
        border-radius: 4px;
      }
      
      .skeleton-active .skeleton-badge {
        width: 80px;
        height: 24px;
        border-radius: 4px;
      }
      
      .skeleton-active .skeleton-title {
        width: 70%;
        height: 20px;
        margin: 16px 0 12px;
      }
      
      .skeleton-active .skeleton-text {
        width: 100%;
        height: 16px;
        margin-bottom: 8px;
      }
      
      .skeleton-active .skeleton-text.short {
        width: 60%;
      }
      
      .skeleton-active .skeleton-tag {
        width: 60px;
        height: 24px;
        display: inline-block;
        margin-right: 8px;
        border-radius: 4px;
      }
      
      .skeleton-active .skeleton-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
      }
      
      .skeleton-active .skeleton-value {
        width: 60px;
        height: 32px;
        margin-bottom: 8px;
      }
      
      .skeleton-active .skeleton-label {
        width: 80px;
        height: 16px;
      }
      
      @keyframes skeletonLoading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      /* Toast 增强样式 */
      .toast-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: bold;
        flex-shrink: 0;
      }
      
      .toast.success .toast-icon {
        background: var(--accent-green);
        color: white;
      }
      
      .toast.error .toast-icon {
        background: var(--error-crimson);
        color: white;
      }
      
      .toast-message {
        font-size: 0.9375rem;
        color: var(--color-text);
      }
      
      /* 卡片悬停增强 */
      .record-card, .stat-card {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        transform-style: preserve-3d;
      }
      
      .record-card:hover, .stat-card:hover {
        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      }
      
      /* 按钮点击反馈 */
      .btn:active {
        transform: scale(0.98);
      }
      
      /* 数字变化动画 */
      .stat-value {
        transition: color 0.3s ease;
      }
      
      .stat-value.updating {
        color: var(--terracotta);
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // 初始化
  // ============================================================
  
  function init() {
    injectStyles();
    HoverEffects.init();
    PageTransitions.init();
    SearchEnhancements.init();
    ModalEnhancements.init();
    
    // 暴露全局 API
    window.EnhancedInteractions = {
      AnimationUtils,
      SkeletonLoader,
      EnhancedToast,
      showToast: EnhancedToast.show,
      animateNumber: AnimationUtils.animateNumber
    };
    
    console.log('✨ Enhanced interactions loaded');
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
