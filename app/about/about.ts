/** The facts the About page shows, all taken from the plan data (pure, so it can be unit-tested). */
import type { Book, Bridge, PlanStep, SectionIndexEntry } from '@/lib/types';

/** What each group of books outside the path is, and why the path leaves it out. */
export const ABOUT_GROUPS: Record<string, string> = {
  Law: 'Laws and rituals for worship and daily life, given in the wilderness.',
  Histories:
    'Histories that retell events the path already follows: Chronicles retells Samuel and Kings, and 2 Maccabees retells part of 1 Maccabees.',
  Wisdom: 'Songs, prayers and sayings: the poetry of Israel and its reflection on life.',
  Prophets:
    'The messages of prophets who spoke to Israel during the story, mostly in the time of the kings and the exile. Jonah, told as a story, is on the path.',
  Gospels:
    'Two more accounts of the life of Jesus. The path follows Luke’s, because Acts continues it.',
  Letters: 'Letters to the early churches and Christians, written during the years Acts covers.',
  Apocalypse:
    'Revelation, the last book of the Bible: symbolic visions of the end of time, not a continuation of the story.',
};

export interface AboutData {
  pathBooks: string[]; // main path, in order
  ot: string[];
  nt: string[];
  otTotal: number;
  ntTotal: number;
  first: string;
  last: string;
  bridges: { id: string; title: string; after: string }[];
  detour: { bookId: string; hostId: string; afterRange: string } | null;
  movable: { id: string; after: string } | null;
  offpath: Book[];
  offpathCount: number;
}

export function aboutData(m: {
  books: Book[];
  steps: PlanStep[];
  sections: SectionIndexEntry[];
  bridges: Bridge[];
}): AboutData {
  const book = (id: string) => m.books.find((b) => b.id === id);
  const bookSteps = m.steps.filter((s) => s.kind === 'book');
  const pathBooks = bookSteps.map((s) => s.id);
  const testament = (t: string) => pathBooks.filter((id) => book(id)?.testament === t);

  const ex = m.steps.find((s) => s.kind === 'excursion');
  const exSection = m.sections.find((s) => s.id === ex?.id);
  const hostSection = m.sections.find((s) => s.id === ex?.after);
  const detour =
    exSection && hostSection
      ? {
          bookId: exSection.bookId,
          hostId: hostSection.bookId,
          afterRange: endOf(hostSection.range),
        }
      : null;

  const mov = bookSteps.findIndex((s) => s.movable);
  const movable = mov > 0 ? { id: bookSteps[mov]!.id, after: bookSteps[mov - 1]!.id } : null;

  const offpath = m.books.filter((b) => !b.inPlan);
  return {
    pathBooks,
    ot: testament('OT'),
    nt: testament('NT'),
    otTotal: m.books.filter((b) => b.testament === 'OT').length,
    ntTotal: m.books.filter((b) => b.testament === 'NT').length,
    first: pathBooks[0]!,
    last: pathBooks.at(-1)!,
    bridges: m.bridges.map(({ id, title, after }) => ({ id, title, after })),
    detour,
    movable,
    offpath,
    offpathCount: offpath.length,
  };
}

/** The last verse of a plan range such as "17:11-19:27" ("19:27"). */
function endOf(range: string): string {
  return range.split('-').at(-1)!;
}
