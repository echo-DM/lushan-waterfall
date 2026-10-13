import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { poem, verses, overview } from './poem';
import { WorldView } from './WorldView';

function Icon({ name, ...props }: { name: 'mountain' | 'pause' | 'play' | 'home' | 'arrow' | 'motion' | 'mouse' } & React.SVGProps<SVGSVGElement>) {
  const shapes: Record<string, ReactNode> = {
    mountain: <><path d="m3 18 6-11 4 7 3-5 5 9H3Z" /><path d="m9 7 2 4H7m9-2 2 4h-4" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    home: <><path d="m3 17 5-8 4 6 4-10 5 12H3Z" /><path d="M3 21h18" /></>,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    motion: <><path d="M3 7h13M3 12h9M3 17h5m10-5 3 3-3 3" /></>,
    mouse: <><rect x="7" y="3" width="10" height="17" rx="5" /><path d="M12 3v6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name]}</svg>;
}

export function App() {
  const [selected, setSelected] = useState(overview.id);
  const [viewRevision, setViewRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [motionChoice, setMotionChoice] = useState<boolean | null>(null);
  const [exploring, setExploring] = useState(false);
  const [arrived, setArrived] = useState(true);
  const reducedMotion = motionChoice ?? systemReduced;
  const currentVerse = verses.find((verse) => verse.id === selected);
  const currentIndex = verses.findIndex((verse) => verse.id === selected);

  const selectView = useCallback((id: string): void => {
    setExploring(false);
    setArrived(reducedMotion);
    setSelected(id);
    setViewRevision((value) => value + 1);
  }, [reducedMotion]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (): void => setSystemReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        selectView(verses[Number(event.key) - 1].id);
      }
      if (event.key === '0') {
        event.preventDefault();
        selectView(overview.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectView]);

  const onVerseKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? verses.length - 1 : (currentIndex + delta + verses.length) % verses.length;
    selectView(verses[next].id);
    document.getElementById(`verse-${verses[next].id}`)?.focus();
  };

  return (
    <div className="app-shell" data-reduced-motion={reducedMotion}>
      <a className="skip-link" href="#poem-navigation">跳到诗句导航</a>
      <header className="site-header">
        <div className="brand">
          <span className="brand-icon"><Icon name="mountain" /></span>
          <div><span className="brand-name">诗中山水</span><span className="brand-subtitle">WORLDS WITHIN WORDS</span></div>
        </div>
        <p className="header-motto">一首诗，一次旅行<span aria-hidden="true"> · </span><span>在山水里，停留片刻</span></p>
        <span className="series-label">唐诗纪游 <span className="series-dot" /> 庐山</span>
      </header>

      <main className="main-layout">
        <section className="landscape-panel" aria-label="庐山交互景观">
          <WorldView view={selected} viewRevision={viewRevision} paused={paused} reducedMotion={reducedMotion} onExplore={() => { setExploring(true); setArrived(true); }} onArrive={() => setArrived(true)} />
          <div className="scene-topline"><span><i /> 庐山 · 白日山谷</span><span className="scene-edition">一片山水，四重诗境</span></div>
          <div className="scene-bottom">
            <div className="scene-caption" aria-live="polite" aria-atomic="true">
              <span className="scene-kicker">{exploring ? '自由观察' : !arrived ? '循诗入境' : currentVerse ? `诗境 ${currentVerse.number} / 04` : '山水全景'}</span>
              <h2>{currentVerse ? currentVerse.name : '日光入山，飞瀑如练。'}</h2>
              <p>{currentVerse ? currentVerse.region : '从香炉峰的紫烟，到崖下的一泓碧水'}</p>
            </div>
            <div className="scene-controls" role="group" aria-label="景观控制">
              <button onClick={() => selectView(overview.id)} aria-label="返回全景（快捷键 0）" title="返回全景 · 0"><Icon name="home" /><span>全景</span></button>
              <span className="control-divider" />
              <button onClick={() => setPaused((value) => !value)} aria-pressed={paused || reducedMotion} disabled={reducedMotion} aria-label={reducedMotion ? '减少动态效果已开启' : paused ? '继续动画' : '暂停动画'} title={paused ? '继续水流与烟霞' : '暂停水流与烟霞'}><Icon name={paused || reducedMotion ? 'play' : 'pause'} /><span>{reducedMotion ? '静止' : paused ? '继续' : '暂停'}</span></button>
            </div>
          </div>
        </section>

        <aside className="poem-panel" id="poem-navigation" aria-labelledby="poem-title">
          <div className="poem-heading">
            <span className="poem-eyebrow"><span /> 循着诗句，走进山水</span>
            <h1 id="poem-title">{poem.title}</h1>
            <p className="poem-author">{poem.dynasty}<span className="author-rule" />{poem.author}<span className="poem-form">七言绝句</span></p>
          </div>

          <div className="verse-list" role="group" aria-label="选择诗句移动镜头" onKeyDown={onVerseKey}>
            {verses.map((verse) => (
              <button key={verse.id} id={`verse-${verse.id}`} className={`verse-button ${selected === verse.id ? 'is-current' : ''}`} aria-pressed={selected === verse.id} data-view={verse.id} onClick={() => selectView(verse.id)}>
                <span className="verse-number">{verse.number}</span>
                <span className="verse-content"><span className="verse-text">{verse.text}</span><span className="verse-name">{verse.name}</span></span>
                <Icon name="arrow" className="verse-arrow" />
              </button>
            ))}
          </div>

          <div className="poem-note">
            <span className="note-mark" aria-hidden="true">「</span>
            <p>{currentVerse?.description ?? '远望是白练，近看是奔流。循着李白的目光，在同一片山水里，慢慢靠近这场瀑布。'}</p>
          </div>
          <div className="panel-bottom">
            <p className="navigation-hint"><Icon name="mouse" /><span>点击诗句入境 · 拖动环顾 · 滚轮缩放</span></p>
            <button className="motion-button" aria-pressed={reducedMotion} onClick={() => setMotionChoice(!reducedMotion)}><Icon name="motion" /><span>减少动态效果</span><span className={`toggle ${reducedMotion ? 'is-on' : ''}`} aria-hidden="true"><i /></span></button>
          </div>
        </aside>
      </main>

      <footer className="site-footer">
        <p>以方寸，见山河。</p>
        <a href={poem.source.url} target="_blank" rel="noreferrer">诗文出处 <span aria-hidden="true">↗</span></a>
        <span>按 1–4 选句，0 返回全景</span>
      </footer>
    </div>
  );
}
