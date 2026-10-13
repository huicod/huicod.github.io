(() => {
  function initializeTimeline() {
    const root = document.querySelector('.paper-reading .explorer');
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const notes = [
      '原动作中，4.5–5.0 秒的右手运动是待修改对象。这里仅截取 0–6 秒来解释时间安排。',
      '先完成局部修改，原动作总时长暂不变。4.5–5.0 秒是“取消右手运动”的目标区间。',
      '在开头插入 1 秒静止后，原动作整体向后移动。刚才的修改区间对应新时间轴 5.5–6.0 秒。',
    ];
    function segment(start, length, total, kind, label) {
      const part = document.createElement('div');
      part.className = `segment ${kind}`;
      part.style.left = `${100 * start / total}%`;
      part.style.width = `${100 * length / total}%`;
      part.title = label;
      part.textContent = label;
      return part;
    }
    function selectStep(step) {
      const offset = step === 2 ? 1 : 0;
      const total = 6 + offset;
      root.querySelectorAll('[data-step]').forEach(button => {
        button.setAttribute('aria-pressed', String(Number(button.dataset.step) === step));
      });
      root.querySelector('.time-note').textContent = notes[step];
      const motion = root.querySelector('#motion-track');
      const hand = root.querySelector('#hand-track');
      motion.replaceChildren();
      hand.replaceChildren();
      if (offset) {
        motion.append(segment(0, 1, total, 'wait', '静止 1 秒'));
        hand.append(segment(0, 1, total, 'wait', '静止'));
      }
      motion.append(segment(offset, 6, total, 'base', `原动作内容${offset ? '（后移 1 秒）' : ''}`));
      hand.append(segment(offset + 4.5, .5, total, step === 0 ? 'source' : 'target', step === 0 ? '待改' : '取消'));
      const axis = root.querySelector('#time-axis');
      axis.replaceChildren(...Array.from({length: total + 1}, (_, time) => {
        const label = document.createElement('span');
        label.textContent = `${time}s`;
        return label;
      }));
    }
    root.querySelectorAll('[data-step]').forEach(button => {
      button.addEventListener('click', () => selectStep(Number(button.dataset.step)));
    });
    selectStep(0);
  }
  initializeTimeline();
  document.addEventListener('astro:page-load', initializeTimeline);
})();
