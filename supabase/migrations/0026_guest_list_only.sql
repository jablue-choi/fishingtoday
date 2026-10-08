-- 로그인 전에는 대화방·피드 '글 목록'까지만. 글 상세(댓글)는 로그인 후
--  0025에서 열었던 댓글 읽기를 다시 막음. 글 목록(미리보기)은 그대로
drop policy if exists "ccomments_read_anon" on public.community_comments;
revoke select on public.community_comments from anon;
drop policy if exists "fcomments_read_anon" on public.feed_comments;
revoke select on public.feed_comments from anon;
