import AppsIcon from "@mui/icons-material/Apps";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import ListSubheader from "@mui/material/ListSubheader";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { getGroupedNavigation, getVisibleNavigation } from "../navigation";
import { useAuth } from "../state/AuthContext";

const drawerWidth = 272;

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = user?.permission_codes ?? [];
  const visibleItems = useMemo(() => getVisibleNavigation(permissions), [permissions]);
  const groupedItems = useMemo(() => getGroupedNavigation(permissions), [permissions]);
  const bottomItems = [
    ...visibleItems.filter((item) => item.bottom).slice(0, 4),
    { label: "Menu", path: "/app/menu", icon: AppsIcon },
  ];
  // Por segmento: /app/receipts/invoices não pode casar com /app/receipts/invoice.
  const matches = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const current = visibleItems.find((item) => matches(item.path));
  const currentBottom = bottomItems.findIndex((item) => matches(item.path));

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">REMOBS</Typography>
        <Typography variant="body2" color="text.secondary">
          Inventário operacional
        </Typography>
      </Box>
      <Divider />
      <List sx={{ px: 1, flex: 1 }}>
        {groupedItems.map(({ group, items }) => (
          <Box component="li" key={group} sx={{ listStyle: "none" }}>
            <ListSubheader
              component="div"
              disableSticky
              sx={{ lineHeight: "32px", mt: 1, bgcolor: "transparent", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              {group}
            </ListSubheader>
            <Box component="ul" sx={{ p: 0, m: 0 }}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <ListItemButton
                    key={item.path}
                    component={NavLink}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    sx={{
                      my: 0.25,
                      "&.active": { bgcolor: "primary.light", color: "primary.dark" },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                );
              })}
            </Box>
          </Box>
        ))}
      </List>
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" fontWeight={700}>
          {user?.username || "Usuário"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {permissions.includes("*") ? "Acesso total" : `${permissions.length} permissões`}
        </Typography>
        <Button fullWidth startIcon={<LogoutIcon />} onClick={logout} sx={{ mt: 1 }}>
          Sair
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton onClick={() => setDrawerOpen(true)} sx={{ display: { md: "none" }, mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {current?.label || "REMOBS Inventário"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={navigator.onLine ? "Online" : "Offline"} color={navigator.onLine ? "success" : "warning"} />
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flex: 1, px: { xs: 2, md: 3 }, pt: 10, pb: { xs: 10, md: 3 }, minWidth: 0 }}>
        <Outlet />
      </Box>

      <BottomNavigation
        value={currentBottom >= 0 ? currentBottom : 0}
        onChange={(_, value: number) => navigate(bottomItems[value].path)}
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: "1px solid",
          borderColor: "divider",
          height: 64,
          zIndex: 1200,
        }}
      >
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return <BottomNavigationAction key={item.path} label={item.label} icon={<Icon />} />;
        })}
      </BottomNavigation>
    </Box>
  );
}
