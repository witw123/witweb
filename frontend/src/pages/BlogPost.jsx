import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { marked } from "marked";

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState("loading");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  function loadPost() {
    const token = localStorage.getItem("token");
    fetch(`/api/blog/${slug}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        setPost(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  function loadComments() {
    fetch(`/api/blog/${slug}/comments`)
      .then((res) => res.json())
      .then((data) => {
        setComments(Array.isArray(data) ? data : []);
      })
      .catch(() => setComments([]));
  }

  useEffect(() => {
    setStatus("loading");
    loadPost();
    loadComments();
  }, [slug]);

  async function handleLike() {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }
    const res = await fetch(`/api/blog/${slug}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return;
    }
    await res.json().catch(() => ({}));
    loadPost();
  }

  async function handleComment(event) {
    event.preventDefault();
    setCommentStatus("");
    if (!commentText.trim()) {
      setCommentStatus("请输入评论内容。");
      return;
    }
    const token = localStorage.getItem("token");
    const profile = (() => {
      try {
        return JSON.parse(localStorage.getItem("profile") || "");
      } catch {
        return null;
      }
    })();
    const res = await fetch(`/api/blog/${slug}/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        content: commentText,
        author: profile?.nickname || profile?.username || "访客",
        parent_id: replyTo?.id || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCommentStatus(data.detail || "评论失败。");
      return;
    }
    setCommentText("");
    setReplyTo(null);
    setCommentStatus("评论已发布。");
    loadComments();
    loadPost();
  }

  const tagList = (post?.tags || "")
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Sora2 Studio Pro</h1>
        </div>
      </header>
      <div className="post-toolbar">
        <Link className="button ghost" to="/">
          返回讨论区
        </Link>
      </div>
      {post?.title && <h2 style={{ marginTop: 0 }}>{post.title}</h2>}
      {post && (
        <div className="meta meta-detail">
          <div className="meta-author">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt={post.author_name} />
            ) : (
              <div className="avatar-fallback">{post.author_name?.[0] || "U"}</div>
            )}
            <span>{post.author_name || post.author}</span>
          </div>
          <div className="meta-actions">
            <button className="comment-action" type="button" onClick={handleLike}>
              赞 {post.like_count ?? 0}
            </button>
            <button
              className="comment-action"
              type="button"
              onClick={() => {
                const token = localStorage.getItem("token");
                if (!token) return;
                fetch(`/api/blog/${slug}/dislike`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then((res) => res.json())
                  .then(() => loadPost())
                  .catch(() => {});
              }}
            >
              踩 {post.dislike_count ?? 0}
            </button>
            <span>💬 {post.comment_count ?? 0}</span>
          </div>
        </div>
      )}
      {tagList.length > 0 && (
        <div className="tag-list tag-list-detail">
          {tagList.map((tag) => (
            <span key={tag} className="tag-pill">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {status === "loading" && <p>加载中...</p>}
      {status === "error" && <p>加载失败，请稍后再试。</p>}
      {status === "ready" && post && (
        <>
          <article
            className="markdown"
            dangerouslySetInnerHTML={{ __html: marked.parse(post.content || "") }}
          />
          {post.created_at && (
            <div className="post-footer">
              <span className="muted">
                发布时间：{new Date(post.created_at).toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}

      <section className="card comments">
        <form className="form" onSubmit={handleComment}>
          <label>
            评论
            <textarea
              rows={4}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder={replyTo ? `回复 @${replyTo.author_name || replyTo.author}` : "写下你的观点..."}
            />
          </label>
          {commentStatus && <p className="status">{commentStatus}</p>}
          {replyTo && (
            <button
              className="button ghost"
              type="button"
              onClick={() => setReplyTo(null)}
            >
              取消回复
            </button>
          )}
          <button className="button ghost" type="submit">
            发布评论
          </button>
        </form>

        <div className="comment-list">
          {comments.length === 0 && <p className="muted">暂无评论。</p>}
          {comments
            .filter((comment) => !comment.parent_id)
            .map((comment) => {
              const replies = comments.filter((c) => c.parent_id === comment.id);
              return (
                <div key={comment.id} className="comment-item">
                  {comment.author_avatar ? (
                    <img src={comment.author_avatar} alt={comment.author_name} />
                  ) : (
                    <div className="avatar-fallback">{comment.author_name?.[0] || "U"}</div>
                  )}
                  <div>
                    <div className="comment-head">
                      <strong>{comment.author_name || comment.author}</strong>
                      <span className="comment-badge">Lv1</span>
                    </div>
                    <p className="comment-body">{comment.content}</p>
                    <div className="comment-meta">
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                      <button
                        className="comment-action"
                        type="button"
                        onClick={() => {
                          const token = localStorage.getItem("token");
                          if (!token) return;
                          fetch(`/api/comment/${comment.id}/like`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` },
                          })
                            .then(loadComments)
                            .catch(() => {});
                        }}
                      >
                        赞 {comment.like_count ?? 0}
                      </button>
                      <button
                        className="comment-action"
                        type="button"
                        onClick={() => {
                          const token = localStorage.getItem("token");
                          if (!token) return;
                          fetch(`/api/comment/${comment.id}/dislike`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` },
                          })
                            .then(loadComments)
                            .catch(() => {});
                        }}
                      >
                        踩 {comment.dislike_count ?? 0}
                      </button>
                      <button
                        className="comment-action"
                        type="button"
                        onClick={() => setReplyTo(comment)}
                      >
                        回复
                      </button>
                    </div>
                    {replies.length > 0 && (
                      <div className="comment-replies">
                        {replies.map((reply) => (
                          <div key={reply.id} className="comment-item reply">
                            {reply.author_avatar ? (
                              <img src={reply.author_avatar} alt={reply.author_name} />
                            ) : (
                              <div className="avatar-fallback">{reply.author_name?.[0] || "U"}</div>
                            )}
                            <div>
                              <div className="comment-head">
                                <strong>{reply.author_name || reply.author}</strong>
                                <span className="comment-badge">Lv1</span>
                              </div>
                              <p className="comment-body">{reply.content}</p>
                              <div className="comment-meta">
                                <span>{new Date(reply.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
