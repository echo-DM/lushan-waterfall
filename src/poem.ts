export type VectorTuple = readonly [number, number, number];

export interface ViewConfig {
  id: string;
  name: string;
  position: VectorTuple;
  target: VectorTuple;
  minDistance: number;
  maxDistance: number;
  maxPolarAngle: number;
}

export interface VerseConfig extends ViewConfig {
  number: string;
  text: string;
  description: string;
  region: string;
  interpretation?: string;
}

export const poem = {
  title: '望庐山瀑布',
  author: '李白',
  dynasty: '唐',
  edition: '《望庐山瀑布二首》其二',
  source: {
    name: '香港教育局 · 诗文参考版本',
    url: 'https://cd.edb.gov.hk/chi/resource/ncs/download/js_list/JS_wanglushanbaobu.pdf',
  },
} as const;

export const overview: ViewConfig = {
  id: 'overview',
  name: '山水全景',
  position: [108, 76, -130],
  target: [-5, 33, 25],
  minDistance: 30,
  maxDistance: 225,
  maxPolarAngle: Math.PI * 0.67,
};

export const verses: readonly VerseConfig[] = [
  {
    id: 'purple-mist',
    number: '01',
    text: '日照香炉生紫烟，',
    name: '日照 · 紫烟',
    region: '香炉峰顶',
    description: '日光越过山脊，紫色烟霞在香炉峰间轻轻升起。',
    position: [-112, 79, -31],
    target: [-38, 67, 41],
    minDistance: 32,
    maxDistance: 160,
    maxPolarAngle: Math.PI * 0.67,
  },
  {
    id: 'hanging-waterfall',
    number: '02',
    text: '遥看瀑布挂前川。',
    name: '远山 · 悬瀑',
    region: '山谷远眺',
    description: '退到山谷远处，看一匹白练悬在青山与碧潭之间。',
    position: [28, 42, -116],
    target: [-7, 35, 23],
    minDistance: 35,
    maxDistance: 205,
    maxPolarAngle: Math.PI * 0.7,
  },
  {
    id: 'plunging-water',
    number: '03',
    text: '飞流直下三千尺，',
    name: '飞流 · 深潭',
    region: '瀑布近处',
    description: '来到瀑流侧旁，循着银白的水势望向崖下深潭。',
    position: [40, 57, -38],
    target: [-8, 29, 18],
    minDistance: 16,
    maxDistance: 115,
    maxPolarAngle: Math.PI * 0.75,
  },
  {
    id: 'silver-river',
    number: '04',
    text: '疑是银河落九天。',
    name: '仰望 · 九天',
    region: '深潭岸边',
    description: '在潭边抬头，瀑水与高天相接，像银河倾泻而下。',
    interpretation: '以日光中的银白水线与微光承接银河比喻，仍是同一片白日山谷。',
    position: [-4, 5, -21],
    target: [-8, 57, 24],
    minDistance: 18,
    maxDistance: 120,
    maxPolarAngle: Math.PI * 0.86,
  },
];

export function getView(id: string): ViewConfig {
  return verses.find((verse) => verse.id === id) ?? overview;
}
