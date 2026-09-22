import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";

import { getGroupedNavigation } from "../navigation";
import { useAuth } from "../state/AuthContext";

export default function MenuPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const groups = getGroupedNavigation(user?.permission_codes ?? []);

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5">Menu</Typography>
      {groups.map(({ group, items }) => (
        <Stack key={group} spacing={1}>
          <Typography variant="overline" color="text.secondary">
            {group}
          </Typography>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.path}>
                <CardActionArea onClick={() => navigate(item.path)}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Icon color="primary" />
                      <Typography fontWeight={700}>{item.label}</Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      ))}
    </Stack>
  );
}
