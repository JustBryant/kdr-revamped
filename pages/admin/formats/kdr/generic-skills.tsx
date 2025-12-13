import React, { useState, useEffect } from 'react';
import Layout from '../../../../components/Layout';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { Skill, Card } from '../../../../types/class-editor';
import SkillForm from '../../../../components/class-editor/shared/SkillForm';
import CardDescription from '../../../../components/class-editor/shared/CardDescription';
import { CARD_IMAGE_BASE_URL } from '../../../../lib/constants';

const getImageUrl = (konamiId: number) => `${CARD_IMAGE_BASE_URL}/${konamiId}.jpg`;

export default function GenericSkillsEditor() {
  const { data: session, status } = useSession();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [hoveredCard, setHoveredCard] = useState<{ card: Card, skill: Skill } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSkills();
    }
  }, [status]);

  const fetchSkills = async () => {
    try {
      const res = await axios.get('/api/skills/generic');
      setSkills(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch skills', error);
      setLoading(false);
    }
  };

  const handleSave = async (skillData: Skill) => {
    try {
      if (editingSkill) {
        await axios.put('/api/skills/generic', { ...skillData, id: editingSkill.id });
      } else {
        await axios.post('/api/skills/generic', skillData);
      }
      fetchSkills();
      setIsModalOpen(false);
      setEditingSkill(null);
    } catch (error) {
      console.error('Failed to save skill', error);
      alert('Failed to save skill');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this skill?')) return;
    
    try {
      await axios.delete(`/api/skills/generic?id=${id}`);
      fetchSkills();
    } catch (error) {
      console.error('Failed to delete skill', error);
      alert('Failed to delete skill');
    }
  };

  const openNewSkillModal = () => {
    setEditingSkill(null);
    setIsModalOpen(true);
  };

  const openEditSkillModal = (skill: Skill) => {
    setEditingSkill(skill);
    setIsModalOpen(true);
  };

  if (status === 'loading' || loading) return <div>Loading...</div>;

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link href="/admin/formats/kdr" className="text-blue-600 hover:underline mr-4">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Generic Skills</h1>
        </div>
        <button
          onClick={openNewSkillModal}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + New Skill
        </button>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => (
            <div key={skill.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{skill.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditSkillModal(skill)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(skill.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-wrap text-sm">
                {skill.description}
              </p>

              {skill.providesCards && skill.providesCards.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-semibold dark:text-gray-200 mb-2">Provides:</div>
                  <div className="flex flex-wrap gap-2">
                    {skill.providesCards.map(card => (
                      <div 
                        key={card.id} 
                        className="relative group cursor-help"
                        onMouseEnter={(e) => {
                          setHoveredCard({ card, skill });
                          setMousePos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        <img 
                          src={getImageUrl(card.konamiId)} 
                          alt={card.name}
                          className="w-12 h-auto rounded shadow-sm border border-gray-200 dark:border-gray-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {skill.modifications.length > 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {skill.modifications.length} Card Modification{skill.modifications.length !== 1 ? 's' : ''}
                </div>
              )}
              
              {!skill.isSellable && (
                 <div className="mt-2 inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded dark:bg-red-900 dark:text-red-200">
                   Not Sellable
                 </div>
              )}
            </div>
          ))}
          
          {skills.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400">
              No generic skills found. Create one to get started.
            </div>
          )}
        </div>

        {/* Card Hover Preview */}
        {hoveredCard && (
          <div 
            className="fixed z-50 w-72 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 pointer-events-none"
            style={{ 
              top: Math.min(mousePos.y + 20, (typeof window !== 'undefined' ? window.innerHeight : 1000) - 450),
              left: Math.min(mousePos.x + 20, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 320)
            }}
          >
            <img 
              src={getImageUrl(hoveredCard.card.konamiId)} 
              alt={hoveredCard.card.name} 
              className="w-full rounded-lg shadow-md mb-4"
            />
            <div className="space-y-2 text-sm">
              <div className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{hoveredCard.card.name}</div>
              <div className="text-gray-600 dark:text-gray-400 font-medium">{hoveredCard.card.type}</div>
              {hoveredCard.card.atk !== undefined && (
                <div className="flex justify-between text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  <span>ATK/{hoveredCard.card.atk === -1 ? '?' : hoveredCard.card.atk}</span>
                  {hoveredCard.card.def !== undefined && <span>DEF/{hoveredCard.card.def === -1 ? '?' : hoveredCard.card.def}</span>}
                </div>
              )}
              <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <CardDescription card={hoveredCard.card} modifications={hoveredCard.skill.modifications} />
              </div>
            </div>
          </div>
        )}

        <SkillForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          initialSkill={editingSkill}
          title={editingSkill ? 'Edit Generic Skill' : 'New Generic Skill'}
        />
      </div>
  );
}
