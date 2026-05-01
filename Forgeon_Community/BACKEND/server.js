require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const userRoutes = require('./routes/users');
const friendsInvitationsRoutes = require('./routes/friends_invitations');
const groupsInvitationsRoutes = require('./routes/groups_invitations');
const threadsGroupsRoutes = require('./routes/threads_groups');
const searchRoutes = require('./routes/search');
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json());

// connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB connected"))
  .catch(err => console.error(err));

app.use('/api/users', userRoutes);
app.use('/api/friends-invitations', friendsInvitationsRoutes);
app.use('/api/groups-invitations', groupsInvitationsRoutes);
app.use('/api/threads-groups', threadsGroupsRoutes);
app.use('/api/search', searchRoutes);
app.use('/assets', express.static(path.resolve(__dirname, '../FRONTEND/assets')));
app.use('/controllers', express.static(path.resolve(__dirname, '../FRONTEND/controllers')));
app.use('/views', express.static(path.resolve(__dirname, '../FRONTEND/views')));
app.use('/', apiRoutes);

app.listen(3000, () => console.log("Server running on port 3000"));
