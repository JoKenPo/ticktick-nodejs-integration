import axios from 'axios';
import querystring from 'querystring';
// import ObjectId from 'mongodb';
// import arrow from 'arrow';

const API_URL = 'https://api.ticktick.com/api/v2/';
const ALL_TASKS_URL = API_URL + 'batch/check/all';
const ALL_COMPLETED_URL = API_URL + 'task/history';
const BATCH_TASK_URL = API_URL + 'batch/task';
const LIST_URL = API_URL + 'project/all';
const TASK_URL = API_URL + 'task';

const TIME_FORMAT = '%Y-%m-%dT%H:%M:%S.%fZ';

export default class TickTick {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this._session = null;
    this.lists = null;
    this.inbox = "None";
    this.tasks = null;
    this.completed = null;
    this.list_lookup = {};
  }

  async login() {
    this._session = axios.create({
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Origin: 'https://www.ticktick.com',
      },
    });

    const data = {
      username: this.username,
      password: this.password,
      remember: true,
    };

    const response = await this._session.post(
      'https://api.ticktick.com/api/v2/user/signon',
      data
    );

    if (response.status !== 200) {
      throw new Error('Failed to login');
    }

    console.log("resposta foi:", response.status);

    this._session.defaults.headers.common.Cookie = response.headers['set-cookie'];

    // await this.fetch_lists();
    await this.fetch_completed()
  }

  async fetch_lists() {
    const response = await this._session.get(LIST_URL);

    if (response.status !== 200) {
      throw new Error('Failed to fetch lists');
    }

    const data = response.data;
    this.lists = data.map((item) => {
      return {
        id: item.id,
        name: item.name,
      };
    });

    // this.inbox = this.lists.find((item) => item.name === 'Inbox');
  }

  async fetch() {
    await this.fetch_tasks();
    await this.fetch_completed(null, null, 50);
  }

  async fetch_tasks() {
    const response = await this._session.get(ALL_TASKS_URL);
    const data = response.data;

    this.tasks = data.map((item) => {
      return new TickTask(item);
    });

    for (const item of this.tasks) {
      this.populate_task(item);
    }
  }

  async fetch_completed(from, to, limit) {
    const from_qs = from ? from.format(TIME_FORMAT) : '';
    const to_qs = to ? to.format(TIME_FORMAT) : '';
    const qs = querystring.stringify({
      from: from_qs,
      to: to_qs,
      limit: limit,
    });

    const response = await this._session.get(ALL_COMPLETED_URL + '?' + qs);
    const data = response.data;

    this.completed = data.map((item) => {
      return new TickTask(item);
    });

    for (const item of this.completed) {
      this.populate_task(item);
    }
  }

  query(filter = null, order_by = null) {
    if (!filter) {
      filter = () => true;
    }

    const items = this.tasks.filter(filter);

    if (!order_by) {
      order_by = (x) => x.sortOrder;
    }

    items.sort((a, b) => order_by(a) - order_by(b));
    return items;
  }

  populateTask(task) {
    // Date / Time
    for (let [attr, value] of Object.entries(task)) {
      if (value && (attr.endsWith('Date') || attr.endsWith('Time'))) {
        try {
          task[attr] = moment(value).tz(task.timeZone).toDate();
        } catch {
          // Ignore parsing errors
        }
      }
    }
    task.list = this.listLookup[task.projectId];
  }
  
  queryInbox() {
    return this.query((x) => x.list.name === 'Inbox');
  }
  
  queryToday() {
    const filter = (task) => {
      const today = moment().startOf('day').toDate();
      if (task.is_completed) {
        if (moment(task.completedTime).toDate() > today) {
          return true;
        } else {
          return false;
        }
      }
      if (task.startDate && moment(task.startDate).toDate() <= today) {
        return true;
      }
      return false;
    };
    return this.query(filter);
  }
  
  guessTimezone() {
    // Guess user timezone from existing tasks
    for (let task of this.tasks) {
      if (task.timeZone) {
        return task.timeZone;
      }
    }
  }
  
  getListId(name) {
    for (let lst of this.lists) {
      if (lst.name === name) {
        return lst.id;
      }
    }
  }
  
  async add(title, listName = null, extraKwargs = null) {
    if (!this.tasks) {
      await this.fetch();
    }
    let listId;
    if (listName) {
      listId = this.getListId(name = listName);
    } else {
      listId = this.inbox.id;
    }
    const taskId = "new ObjectId().toString()";
    const task = {
      title: title,
      timeZone: this.guessTimezone(),
      id: taskId,
      projectId: listId,
    };
    if (extraKwargs) {
      Object.assign(task, extraKwargs);
    }
    const data = { add: [task] };
    const response = await this.session.post(BATCH_TASK_URL, { json: data });
    return taskId;
  }
  
  async delete(taskId, listId) {
    const task = {
      taskId: taskId,
      projectId: listId,
    };
    const response = await this.session.delete(TASK_URL, { json: [task] });
  }
}