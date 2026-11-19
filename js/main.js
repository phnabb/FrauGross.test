'use strict';

document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================================================
     Общие утилиты
     ========================================================================== */

  /* Блокировка/разблокировка прокрутки страницы */
  const lockPage = () => document.body.classList.add('page--locked');
  const unlockPage = () => document.body.classList.remove('page--locked');

  /* ==========================================================================
     1. Sticky-шапка: модификатор header--scrolled при прокрутке
     ========================================================================== */
  const header = document.querySelector('.header');
  let scrollTicking = false;

  const updateHeaderOnScroll = () => {
    if (!header) return;
    header.classList.toggle('header--scrolled', window.scrollY > 0);
    scrollTicking = false;
  };

  if (header) {
    window.addEventListener(
      'scroll',
      () => {
        if (!scrollTicking) {
          scrollTicking = true;
          window.requestAnimationFrame(updateHeaderOnScroll);
        }
      },
      { passive: true },
    );
    updateHeaderOnScroll();
  }

  /* ==========================================================================
     2. Бургер-меню
     ========================================================================== */
  const burger = document.querySelector('.header__burger');
  const navLinks = document.querySelectorAll('.header__nav-link');

  const closeMenu = () => {
    if (!header || !burger) return;
    header.classList.remove('header--menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
    unlockPage();
  };

  if (burger && header) {
    burger.addEventListener('click', () => {
      const isOpen = header.classList.toggle('header--menu-open');
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
      if (isOpen) {
        lockPage();
      } else {
        unlockPage();
      }
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  /* Закрытие мобильного меню по Escape (не конфликтует с модалкой) */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (modal && modal.classList.contains('modal--open')) return;
    if (header && header.classList.contains('header--menu-open')) {
      closeMenu();
      if (burger) burger.focus();
    }
  });

  /* ==========================================================================
     3. Табы-фильтр акций
     ========================================================================== */
  const tabButtons = Array.from(document.querySelectorAll('.tabs__btn'));
  const tabsList = document.querySelector('.tabs__list');
  const promosPanel = document.querySelector('#promos-panel');
  const cards = document.querySelectorAll('.card');
  const emptyState = document.querySelector('.promos__empty');

  const filterCards = (filter) => {
    cards.forEach((card) => card.classList.remove('card--enter'));

    let visibleCount = 0;
    const appeared = [];

    cards.forEach((card) => {
      const matches = filter === 'all' || card.dataset.category === filter;

      /* Фиксируем состояние ДО переключения класса */
      if (matches && card.classList.contains('card--hidden')) {
        appeared.push(card);
      }

      card.classList.toggle('card--hidden', !matches);
      if (matches) visibleCount += 1;
    });

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }

    if (appeared.length) {
      animateCards(appeared);
    }
  };

  const activateTab = (button) => {
    tabButtons.forEach((btn) => {
      btn.classList.remove('tabs__btn--active');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', '-1');
    });

    button.classList.add('tabs__btn--active');
    button.setAttribute('aria-selected', 'true');
    button.setAttribute('tabindex', '0');

    if (promosPanel && button.id) {
      promosPanel.setAttribute('aria-labelledby', button.id);
    }

    filterCards(button.dataset.filter || 'all');
  };

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button));
  });

  /* Навигация по табам с клавиатуры */
  if (tabsList && tabButtons.length) {
    tabsList.addEventListener('keydown', (event) => {
      const currentIndex = tabButtons.indexOf(document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = null;

      if (event.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabButtons.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabButtons.length - 1;
      }

      if (nextIndex === null) return;
      event.preventDefault();
      tabButtons[nextIndex].focus();
      activateTab(tabButtons[nextIndex]);
    });
  }

  /* ==========================================================================
     4. Аккордеон условий акции
     ========================================================================== */
  const detailsToggles = document.querySelectorAll('.card__details-toggle');

  detailsToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const details = toggle.closest('.card__details');
      if (!details) return;

      const isOpen = details.classList.toggle('card__details--open');
      toggle.setAttribute('aria-expanded', String(isOpen));

      const list = details.querySelector('.card__details-list');
      if (list) {
        list.setAttribute('aria-hidden', String(!isOpen));

        if (isOpen) {
          /* Снимаем ограничение и transition, чтобы измерить полную высоту с padding */
          list.style.transition = 'none';
          list.style.maxHeight = 'none';
          const fullHeight = list.getBoundingClientRect().height;
          list.style.maxHeight = '';
          list.style.transition = '';
          list.style.setProperty('--card-details-height', Math.ceil(fullHeight) + 'px');
        } else {
          list.style.setProperty('--card-details-height', '0px');
        }
      }
    });
  });

  /* ==========================================================================
     5–6. Модалка бронирования, валидация и маска телефона
     ========================================================================== */
  const modal = document.querySelector('#modal');
  const modalDialog = modal ? modal.querySelector('.modal__dialog') : null;
  const modalForm = document.querySelector('#booking-form');
  const modalSuccess = document.querySelector('.modal__success');
  const formError = document.querySelector('#form-error');

  const fieldName = document.querySelector('#field-name');
  const fieldPhone = document.querySelector('#field-phone');
  const fieldPromo = document.querySelector('#field-promo');

  const modalOpenButtons = document.querySelectorAll('[data-modal-open]');
  const modalCloseButtons = document.querySelectorAll('[data-modal-close]');

  let lastFocusedElement = null;

  /* Список фокусируемых элементов внутри диалога (только видимые) */
  const getFocusableElements = () => {
    if (!modalDialog) return [];
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(modalDialog.querySelectorAll(selector)).filter(
      (el) => el.offsetParent !== null,
    );
  };

  /* Показ/скрытие блока ошибки */
  const showError = (message) => {
    if (!formError) return;
    formError.textContent = message;
    formError.hidden = false;
  };

  const hideError = () => {
    if (!formError) return;
    formError.textContent = '';
    formError.hidden = true;
  };

  /* Маска телефона: +7 (___) ___-__-__ */
  const formatPhone = (value) => {
    let digits = value.replace(/\D/g, '');

    if (digits.startsWith('8')) {
      digits = '7' + digits.slice(1);
    }
    if (!digits.startsWith('7')) {
      digits = '7' + digits;
    }
    digits = digits.slice(0, 11);

    const rest = digits.slice(1);
    let result = '+7';
    if (rest.length) result += ' (' + rest.slice(0, 3);
    if (rest.length >= 4) result += ') ' + rest.slice(3, 6);
    if (rest.length >= 7) result += '-' + rest.slice(6, 8);
    if (rest.length >= 9) result += '-' + rest.slice(8, 10);
    return result;
  };

  const getPhoneDigits = (value) => value.replace(/\D/g, '');
  const isPhoneValid = (value) => {
    const digits = getPhoneDigits(value);
    return digits.length === 11 && digits.startsWith('7');
  };

  /* Сброс формы к исходному состоянию */
  const resetForm = () => {
    if (!modalForm) return;
    modalForm.reset();
    modalForm.hidden = false;
    if (modalSuccess) modalSuccess.hidden = true;
    hideError();
    if (fieldName) fieldName.setAttribute('aria-invalid', 'false');
    if (fieldPhone) fieldPhone.setAttribute('aria-invalid', 'false');
  };

  /* Открытие модалки */
  const openModal = (trigger) => {
    if (!modal) return;
    lastFocusedElement = trigger || document.activeElement;

    resetForm();

    const promo = trigger ? trigger.dataset.promo : null;
    if (fieldPromo) {
      fieldPromo.value = promo || 'none';
    }

    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
    lockPage();

    const firstInput = modalDialog ? modalDialog.querySelector('.modal__input') : null;
    if (firstInput) firstInput.focus();
  };

  /* Закрытие модалки */
  const closeModal = () => {
    if (!modal || !modal.classList.contains('modal--open')) return;

    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
    unlockPage();

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  };

  modalOpenButtons.forEach((button) => {
    button.addEventListener('click', () => openModal(button));
  });

  modalCloseButtons.forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  /* Закрытие по Escape и удержание фокуса (focus-trap) */
  document.addEventListener('keydown', (event) => {
    if (!modal || !modal.classList.contains('modal--open')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key === 'Tab') {
      const focusable = getFocusableElements();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !modal.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* Маска телефона при вводе */
  if (fieldPhone) {
    fieldPhone.addEventListener('input', () => {
      fieldPhone.value = formatPhone(fieldPhone.value);
      if (fieldPhone.getAttribute('aria-invalid') === 'true' && isPhoneValid(fieldPhone.value)) {
        fieldPhone.setAttribute('aria-invalid', 'false');
      }
    });

    fieldPhone.addEventListener('focus', () => {
      if (!fieldPhone.value) {
        fieldPhone.value = '+7 (';
      }
    });
  }

  /* Отправка формы с валидацией (без сети, имитация) */
  if (modalForm) {
    modalForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const nameValue = fieldName ? fieldName.value.trim() : '';
      const phoneValue = fieldPhone ? fieldPhone.value : '';
      const isNameValid = nameValue.length > 0;
      const isPhoneOk = isPhoneValid(phoneValue);

      if (fieldName) fieldName.setAttribute('aria-invalid', String(!isNameValid));
      if (fieldPhone) fieldPhone.setAttribute('aria-invalid', String(!isPhoneOk));

      if (!isNameValid || !isPhoneOk) {
        showError('Заполните имя и телефон корректно');
        const firstInvalid = !isNameValid ? fieldName : fieldPhone;
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      hideError();
      modalForm.hidden = true;
      if (modalSuccess) modalSuccess.hidden = false;

      const successFocus = modalSuccess
        ? modalSuccess.querySelector('[data-modal-close]')
        : null;
      if (successFocus) successFocus.focus();
    });
  }

  /* ==========================================================================
     7. Cookie-плашка
     ========================================================================== */
  const cookieBar = document.querySelector('#cookie');
  const cookieAccept = document.querySelector('[data-cookie-accept]');

  const safeStorage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        /* localStorage недоступен — молча игнорируем */
      }
    },
  };

  if (cookieBar) {
    if (safeStorage.get('frau-cookies-accepted') === 'true') {
      cookieBar.classList.add('cookie--hidden');
    }

    if (cookieAccept) {
      cookieAccept.addEventListener('click', () => {
        safeStorage.set('frau-cookies-accepted', 'true');
        cookieBar.classList.add('cookie--hidden');
      });
    }
  }

  /* ==========================================================================
     8. Анимации появления (reveal)
     ========================================================================== */
  const revealTargets = document.querySelectorAll(
    '.hero__title, .hero__subtitle, .tabs, .promos__grid .card',
  );

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = motionQuery.matches;

  motionQuery.addEventListener('change', (event) => {
    reduceMotion = event.matches;
    if (reduceMotion) {
      revealTargets.forEach((target) => target.classList.add('reveal--visible'));
    }
  });

  /* Progressive enhancement: базовый класс навешиваем сразу */
  revealTargets.forEach((target) => target.classList.add('reveal'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    /* Без анимации — показываем всё сразу */
    revealTargets.forEach((target) => target.classList.add('reveal--visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        const visible = entries.filter((entry) => entry.isIntersecting);

        visible.forEach((entry, index) => {
          const target = entry.target;
          target.style.setProperty('--reveal-delay', Math.min(index * 80, 400) + 'ms');
          target.classList.add('reveal--visible');
          observer.unobserve(target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );

    revealTargets.forEach((target) => revealObserver.observe(target));
  }

  /* ==========================================================================
     9. Плавная перестройка при фильтрации
     ========================================================================== */
  const animateCards = (list) => {
    if (reduceMotion || !list || !list.length) return;

    /* Анимируем только карточки, уже прошедшие reveal — иначе мигание из-за translate */
    const animated = list.filter((card) => card.classList.contains('reveal--visible'));
    if (!animated.length) return;

    animated.forEach((card, index) => {
      card.classList.remove('card--enter');

      window.requestAnimationFrame(() => {
        card.style.setProperty('--card-delay', index * 60 + 'ms');
        card.classList.add('card--enter');
      });

      card.addEventListener(
        'animationend',
        () => card.classList.remove('card--enter'),
        { once: true },
      );
    });
  };
});
