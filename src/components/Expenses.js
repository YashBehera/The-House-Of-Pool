import React, { useState, useEffect } from "react";
import { Table, Button, Form, Input, Modal, Typography } from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import Navbar from "./Navbar";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";

const { Title } = Typography;

const Expenses = ({ selectedLocation, setSelectedLocation }) => {
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false); // Add modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // Edit modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // Delete confirmation modal
  const [editRecord, setEditRecord] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null); // Store record to delete
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Columns for the table
  const columns = [
    {
      title: "Expense",
      dataIndex: "expense",
      key: "expense",
      sorter: (a, b) => a.expense.localeCompare(b.expense),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      sorter: (a, b) => a.amount - b.amount,
      render: (amount) => `Rs ${amount.toFixed(2)}`,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // Fetch expenses from Firestore
  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const expensesCollection = collection(db, "expenses");
        const snapshot = await getDocs(expensesCollection);
        const fetchedExpenses = snapshot.docs
          .map((doc) => ({
            key: doc.id,
            ...doc.data(),
          }))
          .filter((expense) => expense.location === selectedLocation);
        setExpenses(fetchedExpenses);
      } catch (error) {
        console.error("Error fetching expenses:", error);
        alert("Failed to load expenses: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [selectedLocation]);

  // Handle adding a new expense
  const handleAddExpense = async (values) => {
    const newExpense = {
      expense: values.expense,
      amount: parseFloat(values.amount),
      location: selectedLocation,
    };

    try {
      const docRef = await addDoc(collection(db, "expenses"), newExpense);
      setExpenses([...expenses, { key: docRef.id, ...newExpense }]);
      form.resetFields();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding expense:", error);
      alert("Failed to add expense: " + error.message);
    }
  };

  // Handle editing an existing expense
  const handleEdit = (record) => {
    setEditRecord(record);
    setIsEditModalOpen(true);
    editForm.setFieldsValue({
      expense: record.expense,
      amount: record.amount,
    });
  };

  const handleUpdateExpense = async (values) => {
    const updatedExpense = {
      expense: values.expense,
      amount: parseFloat(values.amount),
      location: selectedLocation,
    };

    try {
      const expenseDocRef = doc(db, "expenses", editRecord.key);
      await updateDoc(expenseDocRef, updatedExpense);
      const updatedExpenses = expenses.map((item) =>
        item.key === editRecord.key ? { ...item, ...updatedExpense } : item
      );
      setExpenses(updatedExpenses);
      setIsEditModalOpen(false);
      setEditRecord(null);
      editForm.resetFields();
    } catch (error) {
      console.error("Error updating expense:", error);
      alert("Failed to update expense: " + error.message);
    }
  };

  // Handle deleting an expense with confirmation
  const handleDelete = (record) => {
    console.log("Delete button clicked for record:", record); // Debug log
    setDeleteRecord(record);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteRecord) return;
    console.log("Confirmed deletion for:", deleteRecord.key); // Debug log
    try {
      const expenseDocRef = doc(db, "expenses", deleteRecord.key);
      await deleteDoc(expenseDocRef);
      setExpenses(expenses.filter((item) => item.key !== deleteRecord.key));
      console.log("Expense deleted successfully"); // Debug log
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Failed to delete expense: " + error.message);
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteRecord(null);
    }
  };

  const cancelDelete = () => {
    console.log("Deletion canceled"); // Debug log
    setIsDeleteModalOpen(false);
    setDeleteRecord(null);
  };

  return (
    <div className="flex flex-col gap-16 p-5">
      <div>
        <Navbar
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          selectedDate={new Date().toISOString().split("T")[0]}
          setSelectedDate={() => {}}
        />
      </div>
      <div>
        <Title level={2}>Expenses for {selectedLocation}</Title>
        <Button
          type="primary"
          onClick={() => setIsModalOpen(true)}
          style={{ marginBottom: "20px" }}
          disabled={loading}
        >
          Add Expense
        </Button>

        <Table
          columns={columns}
          dataSource={expenses}
          rowKey="key"
          pagination={{ pageSize: 10 }}
          bordered
          loading={loading}
        />

        {/* Add Expense Modal */}
        <Modal
          title="Add New Expense"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
        >
          <Form form={form} onFinish={handleAddExpense} layout="vertical">
            <Form.Item
              name="expense"
              label="Expense"
              rules={[
                { required: true, message: "Please enter the expense name" },
              ]}
            >
              <Input placeholder="Enter expense name" />
            </Form.Item>
            <Form.Item
              name="amount"
              label="Amount"
              rules={[
                { required: true, message: "Please enter the amount" },
              ]}
            >
              <Input type="number" min="0" placeholder="Enter amount" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" disabled={loading}>
                Add
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Expense Modal */}
        <Modal
          title="Edit Expense"
          open={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          footer={null}
        >
          <Form
            form={editForm}
            onFinish={handleUpdateExpense}
            layout="vertical"
          >
            <Form.Item
              name="expense"
              label="Expense"
              rules={[
                { required: true, message: "Please enter the expense name" },
              ]}
            >
              <Input placeholder="Enter expense name" />
            </Form.Item>
            <Form.Item
              name="amount"
              label="Amount"
              rules={[
                { required: true, message: "Please enter the amount" },
              ]}
            >
              <Input type="number" min="0" placeholder="Enter amount" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" disabled={loading}>
                Update
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          title="Confirm Deletion"
          open={isDeleteModalOpen}
          onOk={confirmDelete}
          onCancel={cancelDelete}
          okText="Yes"
          okButtonProps={{ danger: true }}
          cancelText="No"
        >
          <p>
            Are you sure you want to delete the expense "{deleteRecord?.expense}
            " of Rs {deleteRecord?.amount.toFixed(2)}?
          </p>
        </Modal>
      </div>
    </div>
  );
};

export default Expenses;
