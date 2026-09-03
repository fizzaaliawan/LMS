import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8000` : "http://localhost:8000");

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  async function fetchNotifications() {
    const token = localStorage.getItem("lms_token");

    if (!token) return;

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      const [notificationsRes, countRes] = await Promise.all([
        fetch(`${API_URL}/notifications`, {
          headers,
        }),

        fetch(`${API_URL}/notifications/unread-count`, {
          headers,
        }),
      ]);

      const notificationsData = await notificationsRes.json();
      const countData = await countRes.json();

      setNotifications(notificationsData);
      setUnreadCount(countData.count);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchNotifications();

    const token = localStorage.getItem("lms_token");
    if (!token) return;

    // Connect to Server-Sent Events (SSE) for real-time notifications
    const eventSource = new EventSource(`${API_URL}/sse?token=${encodeURIComponent(token)}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          // Prepend new notification to the active list
          const newNotif = {
            id: data.id,
            message: data.message,
            created_at: data.created_at || new Date().toISOString(),
            is_read: false,
          };
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  async function markAsRead(id) {
    const token = localStorage.getItem("lms_token");

    await fetch(`${API_URL}/notifications/${id}/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    fetchNotifications();
  }

  async function markAllRead() {
    const token = localStorage.getItem("lms_token");

    await fetch(`${API_URL}/notifications/read-all`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    fetchNotifications();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontSize: "24px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        🔔

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              background: "red",
              color: "white",
              borderRadius: "50%",
              padding: "2px 8px",
              fontSize: "12px",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            width: "320px",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "10px",
            zIndex: 1000,
          }}
        >
          <h4>Notifications</h4>

          {notifications.length === 0 && (
            <p>No notifications.</p>
          )}

          {notifications.map((notification) => (
            <div
              key={notification.id}
              style={{
                borderBottom: "1px solid #eee",
                padding: "10px 0",
              }}
            >
              <div>{notification.message}</div>

              <small>
                {new Date(
                  notification.created_at
                ).toLocaleString()}
              </small>

              {!notification.is_read && (
                <div style={{ marginTop: "5px" }}>
                  <button
                    onClick={() =>
                      markAsRead(notification.id)
                    }
                  >
                    Mark as read
                  </button>
                </div>
              )}
            </div>
          ))}

          {notifications.length > 0 && (
            <button 
              onClick={markAllRead}
              style={{
                marginTop: "10px",
                width: "100%",
                padding: "5px",
                cursor: "pointer"
              }}
            >
              Mark all as read
            </button>
          )}
        </div>
      )}
    </div>
  );
}