import { ArticleShell, type ArticleLayoutProps } from './ArticleShell';
import {
  articleByTitle,
  articleCategoryLink,
  articleLink,
  articleNeighbours,
  parentArticleOf,
} from '@/lib/article-neighbours';

// The layout every article's MDX renders (docs/specs/018-help/help-pages.md "Article pages"). A server component:
// it finds the article in the registry by its title and works out its category link and its previous and next
// articles, then hands those few links to the client half (ArticleShell). The registry stays on the server.
export function ArticleLayout(props: ArticleLayoutProps) {
  const article = articleByTitle(props.title);
  if (!article) return <ArticleShell {...props} />;
  const { prev, next } = articleNeighbours(article);
  // A nested article whose MDX names no parent gets the article at its categorySlug path, so its breadcrumb names
  // the parent rather than skipping a level (docs/specs/018-help/help-pages.md "Article pages").
  const parent = props.parentArticle ?? parentArticleOf(article);
  return (
    <ArticleShell
      {...props}
      parentArticle={parent && { title: parent.title, slug: parent.slug }}
      category={articleCategoryLink(article)}
      prev={prev && articleLink(prev)}
      next={next && articleLink(next)}
    />
  );
}
