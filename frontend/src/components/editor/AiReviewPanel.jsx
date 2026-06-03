import { useMemo } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useAIReview } from '../../hooks/useAIReview';

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const findGroupById = (groups = [], groupId) => {
  for (const group of groups) {
    if (group._id === groupId) return group;
    const nested = findGroupById(group.subgroups || [], groupId);
    if (nested) return nested;
  }
  return null;
};

const findCategoryAndGroup = (topics, note) => {
  if (!note) return { category: null, group: null };

  for (const topic of topics || []) {
    for (const category of topic.categories || []) {
      if (category._id === note.categoryId) {
        return {
          category,
          group: note.groupId ? findGroupById(category.groups || [], note.groupId) : null,
        };
      }
    }
  }

  return { category: null, group: null };
};

const Section = ({ title, children }) => {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;

  return (
    <section className="py-3 border-b border-gray-800/30 last:border-b-0">
      <h4 className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">{title}</h4>
      {children}
    </section>
  );
};

const TextBlock = ({ value }) => {
  if (!value) return null;
  return <p className="text-sm leading-relaxed text-gray-300">{value}</p>;
};

const ListBlock = ({ values }) => {
  if (!Array.isArray(values) || values.length === 0) return null;

  return (
    <ul className="space-y-2">
      {values.map((value, index) => (
        <li key={`${value}-${index}`} className="flex gap-2 text-sm leading-relaxed text-gray-300">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500/70" />
          <span>{value}</span>
        </li>
      ))}
    </ul>
  );
};

const ObjectListBlock = ({ values, titleKey, bodyKey }) => {
  if (!Array.isArray(values) || values.length === 0) return null;

  return (
    <div className="space-y-3">
      {values.map((item, index) => (
        <div key={`${item?.[titleKey] || index}-${index}`} className="rounded-md border border-gray-800 bg-[#101010] p-3">
          <h5 className="mb-1 text-sm font-medium text-gray-200">{item?.[titleKey] || `Item ${index + 1}`}</h5>
          <p className="text-xs leading-relaxed text-gray-400">{item?.[bodyKey] || ''}</p>
        </div>
      ))}
    </div>
  );
};

const AiResult = ({ response }) => {
  if (!response?.result) return null;

  const result = response.result;

  return (
    <div className="px-3 pb-4">
      <div className="mb-3 rounded-md border border-gray-800 bg-[#101010] px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
          <span>{response.provider} / {response.model}</span>
          <span>{response.generatedAt ? new Date(response.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
        {response.fallbackFrom && (
          <p className="mt-2 text-xs text-blue-300">
            Used fallback after {response.fallbackFrom} failed.
          </p>
        )}
        {response.truncated && (
          <p className="mt-2 text-xs text-yellow-400">Result is based on truncated content.</p>
        )}
      </div>

      <Section title="Overview">
        <TextBlock value={result.overview} />
      </Section>

      <Section title="Summary">
        <TextBlock value={result.summary} />
      </Section>

      <Section title="Key Points">
        <ListBlock values={result.keyPoints} />
      </Section>

      <Section title="Important Terms">
        <ListBlock values={result.importantTerms} />
      </Section>

      <Section title="Major Subtopics">
        <ListBlock values={result.majorSubtopics} />
      </Section>

      <Section title="Note Breakdown">
        <ObjectListBlock values={result.noteBreakdown} titleKey="title" bodyKey="contribution" />
      </Section>

      <Section title="Group Breakdown">
        <ObjectListBlock values={result.groupBreakdown} titleKey="groupName" bodyKey="summary" />
      </Section>

      <Section title="Connections">
        <ListBlock values={result.connections} />
      </Section>

      <Section title="Study Path">
        <ListBlock values={result.studyPath} />
      </Section>

      <Section title="Review Questions">
        <ListBlock values={result.reviewQuestions} />
      </Section>

      <Section title="Gaps">
        <ListBlock values={result.gaps} />
      </Section>
    </div>
  );
};

const AiReviewPanel = () => {
  const { topics, currentNote } = useNotes();
  const {
    loading,
    error,
    response,
    reviewNote,
    summarizeGroup,
    summarizeCategory,
    clear,
  } = useAIReview(currentNote?._id);

  const { category, group } = useMemo(
    () => findCategoryAndGroup(topics, currentNote),
    [topics, currentNote]
  );

  if (!currentNote) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-600">
        Select a note to use AI review.
      </div>
    );
  }

  const hasContent = stripHtml(currentNote.content).length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-800/30 px-3 py-3">
        <h3 className="mb-1 text-xs font-semibold tracking-wider text-gray-400 uppercase">AI Review</h3>
        <p className="text-xs leading-relaxed text-gray-600">
          Grounded summaries for the selected note and its hierarchy.
        </p>
      </div>

      <div className="space-y-2 border-b border-gray-800/30 px-3 py-3">
        <button
          onClick={() => reviewNote(currentNote._id)}
          disabled={loading || !hasContent}
          className="w-full rounded-md border border-gray-800 bg-[#101010] px-3 py-2 text-left text-sm text-gray-300 transition hover:border-green-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Review Note
          <span className="block text-xs text-gray-600">Summary, key points, gaps, and questions</span>
        </button>

        <button
          onClick={() => summarizeGroup(currentNote.groupId)}
          disabled={loading || !currentNote.groupId}
          className="w-full rounded-md border border-gray-800 bg-[#101010] px-3 py-2 text-left text-sm text-gray-300 transition hover:border-blue-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Summarize Group
          <span className="block text-xs text-gray-600">{group?.name || 'Requires a note inside a group'}</span>
        </button>

        <button
          onClick={() => summarizeCategory(currentNote.categoryId)}
          disabled={loading || !currentNote.categoryId}
          className="w-full rounded-md border border-gray-800 bg-[#101010] px-3 py-2 text-left text-sm text-gray-300 transition hover:border-purple-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Summarize Category
          <span className="block text-xs text-gray-600">{category?.name || 'Requires a categorized note'}</span>
        </button>

        {response && (
          <button
            onClick={clear}
            disabled={loading}
            className="w-full px-3 py-1 text-xs text-gray-500 transition hover:text-gray-300 disabled:opacity-40"
          >
            Clear Result
          </button>
        )}
      </div>

      {loading && (
        <div className="px-3 py-4 text-sm text-gray-500">Generating AI review...</div>
      )}

      {error && (
        <div className="mx-3 mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!loading && !response && !error && (
          <div className="px-3 py-4 text-sm leading-relaxed text-gray-600">
            Choose a review action. AI output will be based only on your saved notes.
          </div>
        )}
        <AiResult response={response} />
      </div>
    </div>
  );
};

export default AiReviewPanel;
