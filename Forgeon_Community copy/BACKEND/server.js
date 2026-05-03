require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const userRoutes = require('./routes/users');
const categoriesRoutes = require('./routes/categories');
const groupsRoutes = require('./routes/groups');
const friendsRoutes = require('./routes/friends');
const groupMembershipsRoutes = require('./routes/group_memberships');
const friendsInvitationsRoutes = require('./routes/friends_invitations');
const groupsInvitationsRoutes = require('./routes/groups_invitations');
const threadsGroupsRoutes = require('./routes/threads_groups');
const searchRoutes = require('./routes/search');
const forumsRoutes = require('./routes/forums');
const threadsRoutes = require('./routes/threads');
const commentsRoutes = require('./routes/comments');
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json());
const uploadsRoot = path.resolve(__dirname, './uploads');
fs.mkdirSync(path.resolve(uploadsRoot, 'groups'), { recursive: true });

// connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB connected"))
  .catch(err => console.error(err));

app.use('/api/users', userRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/group-memberships', groupMembershipsRoutes);
app.use('/api/friends-invitations', friendsInvitationsRoutes);
app.use('/api/groups-invitations', groupsInvitationsRoutes);
app.use('/api/threads-groups', threadsGroupsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/forums', forumsRoutes);
app.use('/api/threads', threadsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/assets', express.static(path.resolve(__dirname, '../FRONTEND/assets')));
app.use('/uploads', express.static(uploadsRoot));
app.use('/controllers', express.static(path.resolve(__dirname, '../FRONTEND/controllers')));
app.use('/views', express.static(path.resolve(__dirname, '../FRONTEND/views')));
app.use('/', apiRoutes);

app.listen(3000, () => console.log("Server running on port 3000"));
