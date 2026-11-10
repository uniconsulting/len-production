import { plans } from './pickers.js?v=13';

const monthsRu = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2027, index, 1)),
  ),
);
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export function filterSummary({ state, icon, fullMonth }, month, batchLabel) {
  const plan = plans.find((entry) => entry.value === state.scenario).title;
  return `<button class="mobile-filter-trigger" type="button" data-action="filters" aria-haspopup="dialog">
    <span><strong>${fullMonth(month.date)}</strong><small>${plan} · ${batchLabel}</small></span>
    <span class="filter-icon" aria-label="Изменить параметры расчёта">${icon('settings', 21)}</span>
  </button>`;
}

const pageTitles = {
  settings: 'Параметры расчёта',
  scenario: 'Сценарий продаж',
  month: 'Расчётный месяц',
};

export function openFilters(dialog, openDialog, ctx, portfolios, trigger) {
  const { state, icon, fullMonth, months } = ctx;
  // The live dashboard changes only after the user applies the whole draft.
  const draft = { month: state.month, portfolio: state.portfolio, scenario: state.scenario };
  const years = [...new Set(months.map((row) => Number(row.date.slice(0, 4))))];
  const selectedMonth = () => months.find((row) => row.m === draft.month);
  let year = Number(selectedMonth().date.slice(0, 4));

  const field = (key, label) => `<div class="parameter-field">
    <span id="parameter-${key}-label">${label}</span>
    <button class="parameter-value" type="button" data-parameter-open="${key}" aria-labelledby="parameter-${key}-label parameter-${key}-value">
      <span id="parameter-${key}-value"></span>${icon('right', 16)}</button></div>`;

  openDialog(
    pageTitles.settings,
    `<form class="parameters-form">
    <div class="parameters-scroll">
      <section class="parameter-page parameter-settings" data-parameter-page="settings">
        ${field('month', pageTitles.month)}
        ${field('scenario', pageTitles.scenario)}
        <p class="parameter-hint" data-scenario-hint></p>
        <fieldset class="parameter-volumes" data-fixed-volumes><legend>Партий в месяц после разгона</legend>
          <div class="parameter-segments">${portfolios
            .map(
              (count) =>
                `<label><input type="radio" name="portfolio" value="${count}" ${count === draft.portfolio ? 'checked' : ''}><span>${count}</span></label>`,
            )
            .join('')}</div>
        </fieldset>
      </section>
      <section class="parameter-page" data-parameter-page="scenario" hidden>
        <div class="parameter-plans" role="group" aria-label="Сценарий продаж">${plans
          .map(
            (plan) =>
              `<button class="parameter-plan" type="button" data-plan-choice="${plan.value}">
            <span><strong>${plan.title}</strong><small>${plan.hint}</small></span>
            <span class="parameter-check" aria-hidden="true">${icon('check', 17)}</span></button>`,
          )
          .join('')}
        </div>
      </section>
      <section class="parameter-page" data-parameter-page="month" hidden>
        <div class="parameter-years" role="group" aria-label="Год">${years
          .map((value) => `<button type="button" data-parameter-year="${value}">${value}</button>`)
          .join('')}</div>
        <div class="parameter-months" role="group"></div>
      </section>
    </div>
    <div class="parameter-footer apply-filters"><button type="submit" class="primary-action">Применить</button></div>
  </form>`,
    trigger,
  );

  const form = dialog.querySelector('.parameters-form');
  const title = dialog.querySelector('#dialog-title');
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'parameter-back';
  back.setAttribute('aria-label', 'Назад к параметрам');
  back.innerHTML = icon('right', 19);
  back.hidden = true;
  title.before(back);
  const volumes = form.querySelector('[data-fixed-volumes]');
  const monthGrid = form.querySelector('.parameter-months');
  const yearsBar = form.querySelector('.parameter-years');
  const scroller = form.querySelector('.parameters-scroll');
  const footer = form.querySelector('.parameter-footer');
  const session = new AbortController();
  const options = { signal: session.signal };
  let currentPage = 'settings';

  function refreshDraft() {
    const plan = plans.find((item) => item.value === draft.scenario);
    form.querySelector('#parameter-scenario-value').textContent = plan.title;
    const hint = form.querySelector('[data-scenario-hint]');
    hint.textContent = plan.hint;
    hint.hidden = plan.value !== 'growth';
    form.querySelector('#parameter-month-value').textContent = fullMonth(selectedMonth().date);
    volumes.hidden = plan.value === 'growth';
    form.querySelectorAll('[data-plan-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.planChoice === plan.value));
    });
  }

  function drawMonths() {
    const available = months.filter((row) => Number(row.date.slice(0, 4)) === year);
    const cursor = available.find((row) => row.m === draft.month) || available[0];
    for (const button of yearsBar.querySelectorAll('button')) {
      const active = Number(button.dataset.parameterYear) === year;
      button.setAttribute('aria-pressed', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    monthGrid.setAttribute('aria-label', 'Месяцы ' + year + ' года');
    monthGrid.innerHTML = monthsRu
      .map((name, index) => {
        const row = available.find((m) => Number(m.date.slice(5)) === index + 1);
        return row
          ? `<button type="button" data-month-choice="${row.m}" aria-label="${fullMonth(row.date)}"
            tabindex="${row.m === cursor.m ? 0 : -1}" aria-pressed="${row.m === draft.month}">${capitalize(name)}</button>`
          : `<button type="button" disabled>${capitalize(name)}</button>`;
      })
      .join('');
  }

  function showPage(key) {
    const previous = currentPage;
    currentPage = key;
    for (const page of form.querySelectorAll('[data-parameter-page]')) {
      page.hidden = page.dataset.parameterPage !== key;
    }
    back.hidden = key === 'settings';
    footer.hidden = key !== 'settings';
    title.textContent = pageTitles[key];
    scroller.scrollTop = 0;
    if (key === 'month') {
      year = Number(selectedMonth().date.slice(0, 4));
      drawMonths();
    }
    const target =
      key === 'settings'
        ? form.querySelector(`[data-parameter-open="${previous}"]`)
        : key === 'month'
          ? yearsBar.querySelector('[aria-pressed="true"]')
          : form.querySelector('[data-plan-choice][aria-pressed="true"]');
    target?.focus({ preventScroll: true });
  }

  refreshDraft();
  back.addEventListener('click', () => showPage('settings'), options);
  form.addEventListener(
    'click',
    (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.parameterOpen) showPage(button.dataset.parameterOpen);
      if (button.dataset.planChoice) {
        draft.scenario = button.dataset.planChoice;
        refreshDraft();
        showPage('settings');
      }
      if (button.dataset.parameterYear) {
        year = Number(button.dataset.parameterYear);
        drawMonths();
      }
      if (button.dataset.monthChoice) {
        draft.month = Number(button.dataset.monthChoice);
        refreshDraft();
        showPage('settings');
      }
    },
    options,
  );
  form.addEventListener(
    'change',
    (event) => {
      if (event.target.name === 'portfolio') draft.portfolio = Number(event.target.value);
    },
    options,
  );

  // A keyboard user can traverse the year strip or the 3-column month grid with one tab stop per group.
  form.addEventListener(
    'keydown',
    (event) => {
      const button = event.target.closest('[data-parameter-year], [data-month-choice]');
      if (!button) return;
      const isYear = button.hasAttribute('data-parameter-year');
      const group = isYear ? yearsBar : monthGrid;
      const buttons = [...group.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(button);
      const offsets = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: isYear ? -1 : -3,
        ArrowDown: isYear ? 1 : 3,
      };
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? buttons.length - 1
            : event.key in offsets
              ? Math.max(0, Math.min(buttons.length - 1, index + offsets[event.key]))
              : null;
      if (next === null) return;
      event.preventDefault();
      if (isYear) {
        year = Number(buttons[next].dataset.parameterYear);
        drawMonths();
      } else {
        button.tabIndex = -1;
        buttons[next].tabIndex = 0;
      }
      buttons[next].focus();
    },
    options,
  );
  dialog.addEventListener(
    'cancel',
    (event) => {
      if (currentPage !== 'settings') {
        event.preventDefault();
        showPage('settings');
      }
    },
    options,
  );
  form.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      if (currentPage !== 'settings') return;
      dialog.close();
      ctx.update(draft, {
        focus: matchMedia('(max-width: 700px)').matches ? '.mobile-filter-trigger' : '#month',
      });
    },
    options,
  );
  dialog.addEventListener(
    'close',
    () => {
      session.abort();
      if (!matchMedia('(max-width: 700px)').matches)
        document.querySelector('#month')?.focus({ preventScroll: true });
    },
    { once: true },
  );
  const phone = matchMedia(
    '(max-width: 700px), (pointer: coarse) and (orientation: landscape) and (max-height: 500px)',
  );
  phone.addEventListener(
    'change',
    () => {
      if (!phone.matches) {
        dialog.close();
        document.querySelector('#month')?.focus({ preventScroll: true });
      }
    },
    options,
  );
}
