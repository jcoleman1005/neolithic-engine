import type { PersonDetail } from '../sim/protocol';
import type { SimulationConfig } from '../sim/types';

export interface InspectorCallbacks {
  onSelectPerson?: (id: number | null) => void;
  onToggleFollow?: () => void;
  isFollowing?: () => boolean;
}

export class InspectorView {
  private callbacks: InspectorCallbacks = {};

  constructor(private readonly container: HTMLElement, callbacks?: InspectorCallbacks) {
    if (callbacks) this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: InspectorCallbacks): void {
    this.callbacks = callbacks;
  }

  public render(
    config: Readonly<SimulationConfig>,
    person: PersonDetail | null = null,
    selectedId: number | string | null = null
  ): void {
    if (!person && !selectedId) {
      this.container.innerHTML = `
        <div class="inspector-empty">
          <p class="hint">Tap any person to inspect them.</p>
          <div class="summary-pill">
            <span class="pill-title">World Size</span>
            <span class="pill-value">${config.worldWidth} × ${config.worldHeight}</span>
          </div>
          <div class="summary-pill">
            <span class="pill-title">Topology</span>
            <span class="pill-value">${config.wrapping ? 'Wrapping' : 'Bounded'}</span>
          </div>
          <div class="summary-pill">
            <span class="pill-title">Calendar</span>
            <span class="pill-value">${config.ticksPerYear} days / year</span>
          </div>
        </div>
      `;
      return;
    }

    if (!person && selectedId !== null) {
      this.container.innerHTML = `
        <div class="inspector-person person-deceased">
          <div class="person-header">
            <h3>Person #${selectedId}</h3>
            <span class="status-badge badge-dead">Deceased</span>
          </div>
          <p class="hint">This person has died and returned to the earth.</p>
          <button class="btn-clear-selection">Clear Selection</button>
        </div>
      `;
      this.container.querySelector('.btn-clear-selection')?.addEventListener('click', () => {
        this.callbacks.onSelectPerson?.(null);
      });
      return;
    }

    if (person) {
      const isFollowing = this.callbacks.isFollowing?.() ?? false;
      const energyPct = Math.min(100, Math.max(0, (person.energy / (config.maxEnergy || 100)) * 100));
      const energyColor = energyPct < 25 ? '#ef4444' : energyPct < 50 ? '#f59e0b' : '#10b981';

      const adultAge = config.adultAge || 5760;
      const elderAge = Math.floor((config.maxAge || 21600) * 0.75);
      const stage =
        person.ageTicks < adultAge ? 'Child' : person.ageTicks >= elderAge ? 'Elder' : 'Adult';

      const stageBadge =
        stage === 'Child' ? 'badge-child' : stage === 'Elder' ? 'badge-elder' : 'badge-adult';

      const avatarColor = person.sex === 'female' ? '#fb7185' : '#38bdf8';

      this.container.innerHTML = `
        <div class="inspector-person">
          <div class="person-card-header">
            <div class="person-avatar" style="background-color: ${avatarColor};">
              <span class="avatar-icon">${person.sex === 'female' ? '♀' : '♂'}</span>
            </div>
            <div class="person-title">
              <div class="person-id-row">
                <span class="person-name">Person #${person.id}</span>
                <span class="status-badge ${stageBadge}">${stage}</span>
                ${person.pregnant ? '<span class="status-badge badge-pregnant">Pregnant</span>' : ''}
              </div>
              <div class="person-subtitle">
                <span>${person.sex === 'female' ? 'Female' : 'Male'}</span> ·
                <span>Age ${person.ageYears} (${person.ageTicks} days)</span> ·
                <span>Gen ${person.generation}</span>
              </div>
            </div>
          </div>

          <div class="person-card-body">
            <div class="stat-bar-group">
              <div class="stat-bar-label">
                <span>Energy</span>
                <span class="stat-bar-val">${person.energy.toFixed(1)} / ${config.maxEnergy || 100}</span>
              </div>
              <div class="stat-bar-track">
                <div class="stat-bar-fill" style="width: ${energyPct}%; background-color: ${energyColor};"></div>
              </div>
            </div>

            ${
              person.pregnant
                ? `
              <div class="stat-bar-group">
                <div class="stat-bar-label">
                  <span>Gestation Progress</span>
                  <span class="stat-bar-val">${person.pregnancyTicks} / ${config.gestationTicks || 270} days</span>
                </div>
                <div class="stat-bar-track">
                  <div class="stat-bar-fill" style="width: ${Math.min(100, (person.pregnancyTicks / (config.gestationTicks || 270)) * 100)}%; background-color: #f43f5e;"></div>
                </div>
              </div>
            `
                : ''
            }

            <div class="person-info-grid">
              <div class="info-item">
                <span class="info-label">Location</span>
                <span class="info-val">Cell (${person.x}, ${person.y})</span>
              </div>
              <div class="info-item">
                <span class="info-label">Slot</span>
                <span class="info-val">#${person.slot}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Mother</span>
                <span class="info-val">${person.motherId > 0 ? `<button class="link-btn btn-parent" data-id="${person.motherId}">#${person.motherId}</button>` : 'Founder'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Father</span>
                <span class="info-val">${person.fatherId > 0 ? `<button class="link-btn btn-parent" data-id="${person.fatherId}">#${person.fatherId}</button>` : 'Founder'}</span>
              </div>
            </div>

            <div class="person-actions">
              <button class="btn-action btn-follow ${isFollowing ? 'active' : ''}">
                ${isFollowing ? 'Following' : 'Follow Camera'}
              </button>
              <button class="btn-action btn-clear-selection">Deselect</button>
            </div>
          </div>
        </div>
      `;

      this.container.querySelector('.btn-follow')?.addEventListener('click', () => {
        this.callbacks.onToggleFollow?.();
      });

      this.container.querySelector('.btn-clear-selection')?.addEventListener('click', () => {
        this.callbacks.onSelectPerson?.(null);
      });

      this.container.querySelectorAll<HTMLButtonElement>('.btn-parent').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id || '0', 10);
          if (id > 0) this.callbacks.onSelectPerson?.(id);
        });
      });
    }
  }

  public clear(): void {
    this.container.innerHTML = '<div class="inspector-empty"><p class="hint">Tap any person to inspect them.</p></div>';
  }
}
