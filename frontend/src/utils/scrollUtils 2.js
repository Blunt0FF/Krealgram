let scrollPosition = 0;

export function lockBodyScroll() {
  // Сохраняем текущую позицию скролла
  scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  
  // Блокируем скролл
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollPosition}px`;
  document.body.style.width = '100%';
}

export function unlockBodyScroll() {
  // Восстанавливаем скролл
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  
  // Возвращаем позицию скролла
  window.scrollTo(0, scrollPosition);
}

export function isBodyLocked() {
  return document.body.style.overflow === 'hidden';
} 